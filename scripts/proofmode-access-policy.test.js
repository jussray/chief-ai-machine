import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ensureProofModeAccessPolicy } from './proofmode-access-policy.mjs';

const ACCOUNT = 'account-1';
const ADMIN = 'admin-token';
const CLIENT_ID = 'client-id.access';
const SERVICE_ID = 'service-token-1';
const APP_NAME = 'chief-ai - Cloudflare Workers';
const TARGET = 'https://5a188322-chief-ai.mcgill-raylene.workers.dev';
const HOST = '5a188322-chief-ai.mcgill-raylene.workers.dev';
const WORKER_ID = 'c81a2d22c29840ed9d61681a3270dbff';
const WORKER_PREVIEW_SUFFIX = 'chief-ai.mcgill-raylene.workers.dev';

function response(result, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return {
        success: status >= 200 && status < 300,
        result,
        errors: [],
        result_info: { page: 1, per_page: 100, total_pages: 1 },
      };
    },
  };
}

const workerRecord = {
  id: WORKER_ID,
  name: 'chief-ai',
  subdomain: {
    previews_enabled: true,
    preview_url_suffix: WORKER_PREVIEW_SUFFIX,
  },
};

function routeFetch({
  serviceTokens,
  apps,
  workers = [workerRecord],
  policiesByApp = {},
  createByApp = {},
}) {
  return vi.fn(async (url, init = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/access/service_tokens')) return response(serviceTokens);
    if (parsed.pathname.endsWith('/access/apps')) return response(apps);
    if (parsed.pathname.endsWith('/workers/workers')) return response(workers);
    const policyMatch = parsed.pathname.match(/\/access\/apps\/([^/]+)\/policies$/);
    if (policyMatch) {
      const appId = decodeURIComponent(policyMatch[1]);
      if (!init.method) return response(policiesByApp[appId] || []);
      if (init.method === 'POST') {
        const body = JSON.parse(init.body);
        const created = createByApp[appId] || { id: 'policy-new', ...body };
        return response(created);
      }
    }
    throw new Error(`Unexpected Cloudflare test request: ${url}`);
  });
}

const baseArgs = {
  mode: 'check',
  accountId: ACCOUNT,
  apiToken: ADMIN,
  targetUrl: TARGET,
  serviceClientId: CLIENT_ID,
  applicationName: APP_NAME,
  nowMs: Date.parse('2026-08-30T00:00:00Z'),
};

const activeToken = {
  id: SERVICE_ID,
  client_id: CLIENT_ID,
  enabled: true,
  expires_at: '2027-08-30T00:00:00Z',
};

const exactPublicApp = {
  id: 'app-exact-public',
  name: 'ProofMode exact immutable preview',
  destinations: [{ type: 'public', uri: `${HOST}/*` }],
};

const workerApp = {
  id: 'app-worker',
  name: APP_NAME,
  destinations: [{ type: 'worker', worker_id: WORKER_ID }],
};

const previewWorkerApp = {
  id: 'app-preview-worker',
  name: APP_NAME,
  destinations: [{ type: 'preview_worker', worker_id: WORKER_ID }],
};

describe('ProofMode Cloudflare Access service-auth bootstrap', () => {
  it('derives the service-token ID and accepts an existing exact-host Service Auth policy', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [workerApp, exactPublicApp],
      policiesByApp: {
        [exactPublicApp.id]: [{
          id: 'policy-1',
          name: 'Existing CI policy',
          decision: 'non_identity',
          include: [{ service_token: { token_id: SERVICE_ID } }],
        }],
      },
    });

    await expect(ensureProofModeAccessPolicy({ ...baseArgs, fetchImpl })).resolves.toEqual({
      state: 'configured',
      changed: false,
      appId: exactPublicApp.id,
      policyId: 'policy-1',
      scope: 'public_exact_host',
      serviceTokenId: SERVICE_ID,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('fails closed when the configured service token is disabled or expired', async () => {
    const disabledFetch = routeFetch({
      serviceTokens: [{ ...activeToken, enabled: false }],
      apps: [exactPublicApp],
    });
    await expect(ensureProofModeAccessPolicy({ ...baseArgs, fetchImpl: disabledFetch })).rejects.toThrow('disabled');
    expect(disabledFetch).toHaveBeenCalledTimes(1);

    const expiredFetch = routeFetch({
      serviceTokens: [{ ...activeToken, expires_at: '2026-08-29T23:59:59Z' }],
      apps: [exactPublicApp],
    });
    await expect(ensureProofModeAccessPolicy({ ...baseArgs, fetchImpl: expiredFetch })).rejects.toThrow('expired');
    expect(expiredFetch).toHaveBeenCalledTimes(1);
  });

  it('resolves preview_worker ahead of worker using the independently observed immutable Worker ID', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [workerApp, previewWorkerApp],
      policiesByApp: { [previewWorkerApp.id]: [] },
    });

    await expect(ensureProofModeAccessPolicy({
      ...baseArgs,
      mode: 'repair',
      fetchImpl,
    })).resolves.toEqual({
      state: 'configured',
      changed: true,
      appId: previewWorkerApp.id,
      policyId: 'policy-new',
      scope: 'preview_worker',
      serviceTokenId: SERVICE_ID,
    });

    const workerRead = fetchImpl.mock.calls.find(([url]) => new URL(url).pathname.endsWith('/workers/workers'));
    expect(workerRead).toBeTruthy();
    const createCall = fetchImpl.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(createCall).toBeTruthy();
    expect(JSON.parse(createCall[1].body)).toEqual({
      name: 'ProofMode CI service auth',
      decision: 'non_identity',
      include: [{ service_token: { token_id: SERVICE_ID } }],
    });
  });

  it('still refuses automatic repair on worker scope because it includes production traffic', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [workerApp],
      policiesByApp: { [workerApp.id]: [] },
    });

    await expect(ensureProofModeAccessPolicy({
      ...baseArgs,
      mode: 'repair',
      fetchImpl,
    })).rejects.toThrow('Effective Access scope worker');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('fails closed when duplicate preview_worker apps make precedence ambiguous', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [
        previewWorkerApp,
        { ...previewWorkerApp, id: 'app-preview-worker-2' },
      ],
    });

    await expect(ensureProofModeAccessPolicy({ ...baseArgs, fetchImpl })).rejects.toThrow(
      'Multiple preview_worker Access applications protect the same Chief Worker',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('fails closed when the Worker registry cannot uniquely bind the hostname name to one immutable Worker ID', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [previewWorkerApp],
      workers: [
        workerRecord,
        { ...workerRecord, id: '617f1d0431a98306ff61e336d79fce86' },
      ],
    });

    await expect(ensureProofModeAccessPolicy({ ...baseArgs, fetchImpl })).rejects.toThrow(
      'Expected exactly one Cloudflare Worker named chief-ai; found 2',
    );
  });

  it('fails closed when the Worker registry preview suffix does not bind to the immutable preview hostname', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [previewWorkerApp],
      workers: [{
        ...workerRecord,
        subdomain: {
          ...workerRecord.subdomain,
          preview_url_suffix: 'other-worker.mcgill-raylene.workers.dev',
        },
      }],
    });

    await expect(ensureProofModeAccessPolicy({ ...baseArgs, fetchImpl })).rejects.toThrow(
      'does not match target chief-ai.mcgill-raylene.workers.dev',
    );
  });

  it('fails closed if Worker identity cannot be read instead of falling back to Access app name or configured app ID', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/access/service_tokens')) return response([activeToken]);
      if (parsed.pathname.endsWith('/access/apps')) return response([previewWorkerApp]);
      if (parsed.pathname.endsWith('/workers/workers')) return response([], 403);
      throw new Error(`Unexpected Cloudflare test request: ${url}`);
    });

    await expect(ensureProofModeAccessPolicy({
      ...baseArgs,
      accessAppId: previewWorkerApp.id,
      fetchImpl,
    })).rejects.toThrow('Cloudflare API request failed with HTTP 403');
  });

  it('fails closed on a broader matching public destination instead of mutating worker policy', async () => {
    const broadPublicApp = {
      id: 'app-broad-public',
      name: 'Broad preview protection',
      destinations: [{ type: 'public', uri: '*.mcgill-raylene.workers.dev/*' }],
    };
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [workerApp, broadPublicApp],
      policiesByApp: { [broadPublicApp.id]: [] },
    });

    await expect(ensureProofModeAccessPolicy({
      ...baseArgs,
      mode: 'repair',
      fetchImpl,
    })).rejects.toThrow('public_path_or_multi_destination');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('refuses repair when an otherwise exact-host application contains any extra destination', async () => {
    const mixedApp = {
      id: 'app-mixed-public',
      name: 'Mixed scope',
      destinations: [
        { type: 'public', uri: `${HOST}/*` },
        { type: 'public', uri: 'other.example.com/*' },
      ],
    };
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [mixedApp],
      policiesByApp: { [mixedApp.id]: [] },
    });

    await expect(ensureProofModeAccessPolicy({
      ...baseArgs,
      mode: 'repair',
      fetchImpl,
    })).rejects.toThrow('public_path_or_multi_destination');
  });

  it('creates only a specific non-identity policy on the exact immutable host app', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [workerApp, exactPublicApp],
      policiesByApp: { [exactPublicApp.id]: [] },
    });

    await expect(ensureProofModeAccessPolicy({
      ...baseArgs,
      mode: 'repair',
      fetchImpl,
    })).resolves.toEqual({
      state: 'configured',
      changed: true,
      appId: exactPublicApp.id,
      policyId: 'policy-new',
      scope: 'public_exact_host',
      serviceTokenId: SERVICE_ID,
    });

    const createCall = fetchImpl.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(createCall).toBeTruthy();
    const body = JSON.parse(createCall[1].body);
    expect(body).toEqual({
      name: 'ProofMode CI service auth',
      decision: 'non_identity',
      include: [{ service_token: { token_id: SERVICE_ID } }],
    });
    expect(body.decision).not.toBe('bypass');
    expect(body.include[0]).not.toHaveProperty('any_valid_service_token');
  });

  it('refuses to overwrite a conflicting named policy', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [exactPublicApp],
      policiesByApp: {
        [exactPublicApp.id]: [{
          id: 'policy-wrong',
          name: 'ProofMode CI service auth',
          decision: 'allow',
          include: [{ everyone: {} }],
        }],
      },
    });

    await expect(ensureProofModeAccessPolicy({
      ...baseArgs,
      mode: 'repair',
      fetchImpl,
    })).rejects.toThrow('Refusing to overwrite it automatically');
  });

  it('fails closed when duplicate public apps make precedence ambiguous', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [
        exactPublicApp,
        { ...exactPublicApp, id: 'app-exact-public-2' },
      ],
    });

    await expect(ensureProofModeAccessPolicy({ ...baseArgs, fetchImpl })).rejects.toThrow(
      'Multiple public Access applications match',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps the existing pre-merge explicit-ID path but validates it against independently observed live precedence', async () => {
    const fetchImpl = routeFetch({
      serviceTokens: [activeToken],
      apps: [workerApp, exactPublicApp],
      policiesByApp: {
        [exactPublicApp.id]: [{
          id: 'policy-1',
          decision: 'non_identity',
          include: [{ service_token: { token_id: SERVICE_ID } }],
        }],
      },
    });

    await expect(ensureProofModeAccessPolicy({
      ...baseArgs,
      serviceClientId: undefined,
      serviceTokenId: SERVICE_ID,
      accessAppId: exactPublicApp.id,
      fetchImpl,
    })).resolves.toMatchObject({
      appId: exactPublicApp.id,
      serviceTokenId: SERVICE_ID,
      scope: 'public_exact_host',
      changed: false,
    });

    const mismatchFetch = routeFetch({
      serviceTokens: [activeToken],
      apps: [workerApp, previewWorkerApp],
    });
    await expect(ensureProofModeAccessPolicy({
      ...baseArgs,
      serviceClientId: undefined,
      serviceTokenId: SERVICE_ID,
      accessAppId: workerApp.id,
      fetchImpl: mismatchFetch,
    })).rejects.toThrow('is not effective for this immutable preview');
  });

  it('does not leak the admin token into request URLs or bodies', async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init = {}) => {
      calls.push({ url: String(url), init });
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/access/service_tokens')) return response([activeToken]);
      if (parsed.pathname.endsWith('/access/apps')) return response([exactPublicApp]);
      if (parsed.pathname.includes('/policies')) {
        return response([{
          id: 'policy-1',
          decision: 'non_identity',
          include: [{ service_token: { token_id: SERVICE_ID } }],
        }]);
      }
      throw new Error(`Unexpected request ${url}`);
    });

    await ensureProofModeAccessPolicy({ ...baseArgs, fetchImpl });
    for (const call of calls) {
      expect(call.url).not.toContain(ADMIN);
      expect(call.init.body || '').not.toContain(ADMIN);
      expect(call.init.headers.Authorization).toBe(`Bearer ${ADMIN}`);
    }
  });
});

describe('ProofMode workflow credential boundaries', () => {
  const proofWorkflow = readFileSync(
    new URL('../.github/workflows/proofmode-mcp-playwright.yml', import.meta.url),
    'utf8',
  );
  const chiefWorkflow = readFileSync(
    new URL('../.github/workflows/chief-capability-plan-playwright.yml', import.meta.url),
    'utf8',
  );
  const adminWorkflow = readFileSync(
    new URL('../.github/workflows/proofmode-access-service-auth.yml', import.meta.url),
    'utf8',
  );

  it('keeps Cloudflare admin mutation only in the protected admin workflow', () => {
    expect(proofWorkflow).not.toContain('CLOUDFLARE_ACCESS_ADMIN_API_TOKEN');
    expect(proofWorkflow).not.toContain('#repair-access');
    expect(adminWorkflow).toContain('environment: proofmode-access-admin');
    expect(adminWorkflow).toContain('CLOUDFLARE_ACCESS_ADMIN_API_TOKEN');
  });

  it.each([
    ['ProofMode MCP', proofWorkflow, 'proofmode_candidate_runtime_evidence'],
    ['Chief capability plan', chiefWorkflow, 'chief_candidate_runtime_evidence'],
  ])('keeps %s PR events secretless and reserves Access secrets for trusted current-main evidence', (_name, workflow, dispatchType) => {
    expect(workflow).toContain('repository_dispatch:');
    expect(workflow).toContain(`types: [${dispatchType}]`);
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).toContain('environment: proofmode-access-admin');
    expect(workflow).toContain("github.event_name == 'repository_dispatch'");
    expect(workflow).toContain('EXPECTED_MAIN_SHA: ${{ github.event.client_payload.expected_main_sha }}');
    expect(workflow).toContain('WORKFLOW_SHA: ${{ github.sha }}');
    expect(workflow).toContain('  pr-runtime-gate:');
    expect(workflow).toContain('  trusted-runtime-evidence:');

    const prGate = workflow.indexOf('  pr-runtime-gate:');
    const trustedEvidence = workflow.indexOf('  trusted-runtime-evidence:');
    const firstAccessSecret = workflow.indexOf('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');

    expect(prGate).toBeGreaterThanOrEqual(0);
    expect(trustedEvidence).toBeGreaterThan(prGate);
    expect(firstAccessSecret).toBeGreaterThan(trustedEvidence);

    const beforeTrustedEvidence = workflow.slice(0, trustedEvidence);
    expect(beforeTrustedEvidence).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
    expect(beforeTrustedEvidence).not.toContain('environment: proofmode-access-admin');

    const trustedSection = workflow.slice(trustedEvidence);
    expect(trustedSection).toContain('ref: ${{ github.sha }}');
    expect(trustedSection).not.toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
  });
});
