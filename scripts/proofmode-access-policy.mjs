const API = 'https://api.cloudflare.com/client/v4';
const POLICY_NAME = 'ProofMode CI service auth';

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

function unwrap(result, label) {
  if (!result || result.success !== true) {
    const code = result?.errors?.[0]?.code;
    throw new Error(`${label} failed${code ? ` (Cloudflare code ${code})` : ''}.`);
  }
  return result.result;
}

function hasSpecificServiceToken(policy, serviceTokenId) {
  return policy?.decision === 'non_identity'
    && Array.isArray(policy.include)
    && policy.include.some((rule) => rule?.service_token?.token_id === serviceTokenId);
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

export async function ensureProofModeAccessPolicy({
  fetchImpl = globalThis.fetch,
  mode,
  accountId,
  apiToken,
  accessAppId,
  serviceTokenId,
}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');

  const normalizedMode = validateMode(mode);
  const account = required(accountId, 'CLOUDFLARE_ACCOUNT_ID');
  const token = required(apiToken, 'CLOUDFLARE_ACCESS_ADMIN_API_TOKEN');
  const appId = required(accessAppId, 'CLOUDFLARE_ACCESS_APP_ID');
  const serviceId = required(serviceTokenId, 'CLOUDFLARE_ACCESS_SERVICE_TOKEN_ID');
  const policyPath = `/accounts/${encodeURIComponent(account)}/access/apps/${encodeURIComponent(appId)}/policies`;

  const listed = unwrap(
    await cloudflareJson(fetchImpl, token, `${policyPath}?per_page=100`),
    'List Access application policies',
  );
  const policies = Array.isArray(listed) ? listed : [];

  const exact = policies.find((policy) => hasSpecificServiceToken(policy, serviceId));
  if (exact) {
    return { state: 'configured', changed: false, policyId: exact.id || null };
  }

  const conflictingNamedPolicy = policies.find((policy) => policy?.name === POLICY_NAME);
  if (conflictingNamedPolicy) {
    throw new Error(
      'A ProofMode CI service-auth policy already exists but does not target the configured service token. Refusing to overwrite it automatically.',
    );
  }

  if (normalizedMode === 'check') {
    throw new Error(
      'No matching Cloudflare Access Service Auth policy exists for the configured ProofMode CI service token.',
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
    throw new Error('Cloudflare created a policy that did not match the requested specific service-token rule.');
  }

  return { state: 'configured', changed: true, policyId: created.id || null };
}

async function main() {
  const result = await ensureProofModeAccessPolicy({
    mode: process.env.PROOFMODE_ACCESS_MODE || 'check',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_ACCESS_ADMIN_API_TOKEN,
    accessAppId: process.env.CLOUDFLARE_ACCESS_APP_ID,
    serviceTokenId: process.env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_ID,
  });

  console.log(`ProofMode Access policy state: ${result.state}; changed=${result.changed}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ProofMode Access policy bootstrap failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  });
}
