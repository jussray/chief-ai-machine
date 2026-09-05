const API = 'https://api.cloudflare.com/client/v4';
const POLICY_NAME = 'ProofMode CI service auth';
const DEFAULT_APP_NAME = 'chief-ai - Cloudflare Workers';
const IMMUTABLE_CHIEF_HOST = /^[0-9a-f]{8}-chief-ai\.mcgill-raylene\.workers\.dev$/i;
const REQUIRED_PATHS = ['/version', '/mcp'];

function required(value, name) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

function validateMode(mode) {
  if (mode !== 'check' && mode !== 'repair') {
    throw new Error('PROOFMODE_ACCESS_MODE must be check or repair.');
  }
  return mode;
}

function validateTargetUrl(raw) {
  const value = required(raw, 'PROOFMODE_ACCESS_TARGET_URL');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('PROOFMODE_ACCESS_TARGET_URL must be a valid URL.');
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.search
    || url.hash
    || url.pathname !== '/'
    || !IMMUTABLE_CHIEF_HOST.test(url.hostname)
  ) {
    throw new Error('PROOFMODE_ACCESS_TARGET_URL must be the origin of one immutable Chief workers.dev preview.');
  }
  return { origin: url.origin, hostname: url.hostname.toLowerCase() };
}

function unwrap(result, label) {
  if (!result || result.success !== true) {
    const code = result?.errors?.[0]?.code;
    throw new Error(`${label} failed${code ? ` (Cloudflare code ${code})` : ''}.`);
  }
  return result.result;
}

function hasSpecificServiceToken(policy, serviceTokenId) {
  if (policy?.decision !== 'non_identity' || !Array.isArray(policy.include) || policy.include.length !== 1) {
    return false;
  }
  const [rule] = policy.include;
  return rule
    && typeof rule === 'object'
    && !Array.isArray(rule)
    && Object.keys(rule).length === 1
    && rule?.service_token?.token_id === serviceTokenId;
}

async function cloudflareJson(fetchImpl, apiToken, path, init = {}) {
  const response = await fetchImpl(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Cloudflare API returned non-JSON HTTP ${response.status}.`);
  }

  if (!response.ok) {
    const code = payload?.errors?.[0]?.code;
    throw new Error(`Cloudflare API request failed with HTTP ${response.status}${code ? ` (code ${code})` : ''}.`);
  }
  return payload;
}

async function listAll(fetchImpl, apiToken, path, label) {
  const collected = [];
  for (let page = 1; page <= 20; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const payload = await cloudflareJson(fetchImpl, apiToken, `${path}${separator}page=${page}&per_page=100`);
    const current = unwrap(payload, label);
    if (!Array.isArray(current)) throw new Error(`${label} returned an unexpected result shape.`);
    collected.push(...current);

    const totalPages = Number(payload?.result_info?.total_pages || 0);
    if (totalPages > 0) {
      if (page >= totalPages) return collected;
      continue;
    }
    if (current.length < 100) return collected;
  }
  throw new Error(`${label} exceeded the bounded pagination limit.`);
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function normalizePublicUri(raw) {
  let value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  value = value.replace(/^https?:\/\//, '');
  return value.replace(/^\/+/, '');
}

function publicUriMatchesPath(uri, hostname, path) {
  const pattern = normalizePublicUri(uri);
  if (!pattern) return false;
  const hostWidePattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
  if (!hostWidePattern.includes('/')) {
    return globToRegExp(hostWidePattern).test(hostname);
  }
  return globToRegExp(pattern).test(`${hostname}${path}`);
}

function isExactHostWidePublicUri(uri, hostname) {
  const pattern = normalizePublicUri(uri).replace(/\/+$/, '');
  return pattern === hostname || pattern === `${hostname}/*`;
}

function uniqueAppsForDestinationType(apps, type) {
  return apps.filter((app) => (app?.destinations || []).some((destination) => destination?.type === type));
}

function resolveEffectiveApplication(apps, hostname, applicationName) {
  const publicMatchesByPath = new Map();
  for (const path of REQUIRED_PATHS) {
    const matches = [];
    for (const app of apps) {
      for (const destination of app?.destinations || []) {
        if (destination?.type === 'public' && publicUriMatchesPath(destination.uri, hostname, path)) {
          matches.push({ app, destination });
        }
      }
    }
    publicMatchesByPath.set(path, matches);
  }

  const pathsWithPublicCoverage = REQUIRED_PATHS.filter((path) => publicMatchesByPath.get(path).length > 0);
  if (pathsWithPublicCoverage.length > 0) {
    if (pathsWithPublicCoverage.length !== REQUIRED_PATHS.length) {
      throw new Error('Public Access application coverage differs across required ProofMode paths; refusing to guess mixed public/Worker precedence.');
    }

    const appIds = [...new Set(REQUIRED_PATHS.flatMap((path) => (
      publicMatchesByPath.get(path).map(({ app }) => app?.id).filter(Boolean)
    )))];
    if (appIds.length !== 1) {
      throw new Error('Multiple public Access applications match required ProofMode paths; refusing to guess effective policy precedence.');
    }

    const selected = publicMatchesByPath.get(REQUIRED_PATHS[0]).find(({ app }) => app?.id === appIds[0])?.app;
    if (!selected) {
      throw new Error('Could not resolve the public Access application shared by all required ProofMode paths.');
    }
    const destinations = Array.isArray(selected?.destinations) ? selected.destinations : [];
    const exactHostOnly = destinations.length === 1
      && destinations[0]?.type === 'public'
      && isExactHostWidePublicUri(destinations[0].uri, hostname);
    return {
      app: selected,
      scope: exactHostOnly ? 'public_exact_host' : 'public_path_or_multi_destination',
      repairEligible: exactHostOnly,
    };
  }

  const namedWorkerDestinations = [];
  for (const app of apps) {
    if (app?.name !== applicationName) continue;
    for (const destination of app?.destinations || []) {
      if ((destination?.type === 'worker' || destination?.type === 'preview_worker') && destination.worker_id) {
        namedWorkerDestinations.push({ app, destination });
      }
    }
  }

  const workerIds = [...new Set(namedWorkerDestinations.map(({ destination }) => destination.worker_id))];
  if (workerIds.length > 1) {
    throw new Error(`Expected at most one Worker identity across Access applications named ${applicationName}; found ${workerIds.length}.`);
  }

  if (workerIds.length === 1) {
    const workerId = workerIds[0];

    const previewApps = apps.filter((app) => (app?.destinations || []).some(
      (destination) => destination?.type === 'preview_worker' && destination.worker_id === workerId,
    ));
    if (previewApps.length > 1) {
      throw new Error('Multiple preview_worker Access applications protect the same Chief Worker; refusing to guess precedence.');
    }
    if (previewApps.length === 1) {
      return { app: previewApps[0], scope: 'preview_worker', repairEligible: true };
    }

    const workerApps = apps.filter((app) => (app?.destinations || []).some(
      (destination) => destination?.type === 'worker' && destination.worker_id === workerId,
    ));
    if (workerApps.length > 1) {
      throw new Error('Multiple worker Access applications protect the same Chief Worker; refusing to guess precedence.');
    }
    if (workerApps.length === 1) {
      return { app: workerApps[0], scope: 'worker', repairEligible: false };
    }
  }

  const allPreviewApps = uniqueAppsForDestinationType(apps, 'all_preview_workers');
  if (allPreviewApps.length > 1) {
    throw new Error('Multiple all_preview_workers Access applications were observed; refusing to guess account-wide preview precedence.');
  }
  if (allPreviewApps.length === 1) {
    return { app: allPreviewApps[0], scope: 'all_preview_workers', repairEligible: false };
  }

  const allWorkerApps = uniqueAppsForDestinationType(apps, 'all_workers');
  if (allWorkerApps.length > 1) {
    throw new Error('Multiple all_workers Access applications were observed; refusing to guess account-wide Worker precedence.');
  }
  if (allWorkerApps.length === 1) {
    return { app: allWorkerApps[0], scope: 'all_workers', repairEligible: false };
  }

  if (workerIds.length === 0) {
    throw new Error(`Could not resolve a Worker-specific or account-wide Access application for ${applicationName}.`);
  }
  throw new Error('Could not resolve an effective Worker-specific Access application for the immutable Chief preview.');
}

function resolveServiceToken(serviceTokens, { serviceClientId, serviceTokenId, nowMs }) {
  const clientId = typeof serviceClientId === 'string' ? serviceClientId.trim() : '';
  const configuredId = typeof serviceTokenId === 'string' ? serviceTokenId.trim() : '';
  if (!clientId && !configuredId) {
    throw new Error('CLOUDFLARE_ACCESS_CLIENT_ID or CLOUDFLARE_ACCESS_SERVICE_TOKEN_ID is required.');
  }

  let matches;
  if (configuredId) {
    matches = serviceTokens.filter((serviceToken) => serviceToken?.id === configuredId);
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one Cloudflare Access service token for the configured token ID; found ${matches.length}.`);
    }
    if (clientId && matches[0]?.client_id !== clientId) {
      throw new Error('Configured Cloudflare Access service-token ID does not match the configured client ID.');
    }
  } else {
    matches = serviceTokens.filter((serviceToken) => serviceToken?.client_id === clientId);
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one Cloudflare Access service token for the configured client ID; found ${matches.length}.`);
    }
  }

  const serviceToken = matches[0];
  const serviceId = required(serviceToken.id, 'Resolved Cloudflare service-token ID');
  if (serviceToken.enabled === false) {
    throw new Error('The configured Cloudflare Access service token is disabled.');
  }
  if (serviceToken.expires_at) {
    const expiresAt = Date.parse(serviceToken.expires_at);
    if (!Number.isFinite(expiresAt)) {
      throw new Error('The configured Cloudflare Access service token has an invalid expires_at value.');
    }
    if (expiresAt <= nowMs) {
      throw new Error('The configured Cloudflare Access service token is expired.');
    }
  }
  return { serviceId, serviceToken };
}

export async function ensureProofModeAccessPolicy({
  fetchImpl = globalThis.fetch,
  mode,
  accountId,
  apiToken,
  targetUrl,
  serviceClientId,
  serviceTokenId,
  accessAppId,
  applicationName = DEFAULT_APP_NAME,
  nowMs = Date.now(),
}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');

  const normalizedMode = validateMode(mode);
  const account = required(accountId, 'CLOUDFLARE_ACCOUNT_ID');
  const token = required(apiToken, 'CLOUDFLARE_ACCESS_ADMIN_API_TOKEN');
  const appName = required(applicationName, 'CLOUDFLARE_ACCESS_APP_NAME');
  const target = validateTargetUrl(targetUrl);

  const serviceTokens = await listAll(
    fetchImpl,
    token,
    `/accounts/${encodeURIComponent(account)}/access/service_tokens`,
    'List Access service tokens',
  );
  const { serviceId } = resolveServiceToken(serviceTokens, {
    serviceClientId,
    serviceTokenId,
    nowMs,
  });

  const apps = await listAll(
    fetchImpl,
    token,
    `/accounts/${encodeURIComponent(account)}/access/apps`,
    'List Access applications',
  );
  const effective = resolveEffectiveApplication(apps, target.hostname, appName);
  const appId = required(effective.app?.id, 'Resolved Cloudflare Access application ID');
  const configuredAppId = typeof accessAppId === 'string' ? accessAppId.trim() : '';
  if (configuredAppId && configuredAppId !== appId) {
    throw new Error(
      `Configured Cloudflare Access app ${configuredAppId} is not effective for this immutable preview; resolved ${appId} (${effective.scope}).`,
    );
  }
  const policyPath = `/accounts/${encodeURIComponent(account)}/access/apps/${encodeURIComponent(appId)}/policies`;

  const policies = await listAll(fetchImpl, token, policyPath, 'List Access application policies');
  const exact = policies.find((policy) => hasSpecificServiceToken(policy, serviceId));
  if (exact) {
    return {
      state: 'configured',
      changed: false,
      appId,
      policyId: exact.id || null,
      scope: effective.scope,
      serviceTokenId: serviceId,
    };
  }

  const conflictingNamedPolicy = policies.find((policy) => policy?.name === POLICY_NAME);
  if (conflictingNamedPolicy) {
    throw new Error(
      'A ProofMode CI service-auth policy already exists but does not exclusively target the configured service token. Refusing to overwrite it automatically.',
    );
  }

  if (normalizedMode === 'check') {
    throw new Error(
      `No matching Cloudflare Access Service Auth policy exists for the configured ProofMode CI service token on effective app ${appId} (${effective.scope}).`,
    );
  }

  if (!effective.repairEligible) {
    throw new Error(
      `Effective Access scope ${effective.scope} is not an approved exact immutable preview host or unique preview_worker application. Refusing automatic repair on app ${appId}.`,
    );
  }

  const created = unwrap(
    await cloudflareJson(fetchImpl, token, policyPath, {
      method: 'POST',
      body: JSON.stringify({
        name: POLICY_NAME,
        decision: 'non_identity',
        include: [{ service_token: { token_id: serviceId } }],
      }),
    }),
    'Create Access application policy',
  );

  if (!hasSpecificServiceToken(created, serviceId)) {
    throw new Error('Cloudflare created a policy that did not match the requested exclusive specific service-token rule.');
  }

  return {
    state: 'configured',
    changed: true,
    appId,
    policyId: created.id || null,
    scope: effective.scope,
    serviceTokenId: serviceId,
  };
}

async function main() {
  const result = await ensureProofModeAccessPolicy({
    mode: process.env.PROOFMODE_ACCESS_MODE || 'check',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_ACCESS_ADMIN_API_TOKEN,
    targetUrl: process.env.PROOFMODE_ACCESS_TARGET_URL || process.env.PROOFMODE_BASE_URL,
    serviceClientId: process.env.CLOUDFLARE_ACCESS_CLIENT_ID,
    serviceTokenId: process.env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_ID,
    accessAppId: process.env.CLOUDFLARE_ACCESS_APP_ID,
    applicationName: process.env.CLOUDFLARE_ACCESS_APP_NAME || DEFAULT_APP_NAME,
  });

  console.log(
    `ProofMode Access policy state: ${result.state}; changed=${result.changed}; scope=${result.scope}; app=${result.appId}; policy=${result.policyId || 'none'}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ProofMode Access policy bootstrap failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  });
}
