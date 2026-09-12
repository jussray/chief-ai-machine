import { describe, expect, it } from 'vitest';
import { ensureProofModeAccessPolicy } from '../scripts/proofmode-access-policy.mjs';

const TARGET = 'https://1234abcd-chief-ai.mcgill-raylene.workers.dev';
const WORKER_ID = 'c81a2d22c29840ed9d61681a3270dbff';
const TOKEN = { id: 'token-1', client_id: 'client-1', enabled: true };
const EXACT_POLICY = {
  id: 'policy-1',
  name: 'ProofMode CI service auth',
  decision: 'non_identity',
  include: [{ service_token: { token_id: TOKEN.id } }],
};

function response(result) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, result, result_info: { total_pages: 1 } }),
  };
}

function cloudflareFixture({
  apps,
  workers = [{ id: WORKER_ID, name: 'chief-ai' }],
  accountSubdomain = 'mcgill-raylene',
  workerSubdomain = { enabled: true, previews_enabled: true },
  policiesByApp = {},
}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const parsed = new globalThis.URL(url);
    const method = init.method || 'GET';
    calls.push({ path: parsed.pathname, method });

    if (parsed.pathname.endsWith('/access/service_tokens')) return response([TOKEN]);
    if (parsed.pathname.endsWith('/access/apps')) return response(apps);
    if (parsed.pathname.endsWith('/workers/workers')) return response(workers);
    if (parsed.pathname.endsWith('/workers/subdomain')) return response({ subdomain: accountSubdomain });
    if (parsed.pathname.endsWith('/workers/scripts/chief-ai/subdomain')) return response(workerSubdomain);

    const policyMatch = parsed.pathname.match(/\/access\/apps\/([^/]+)\/policies$/);
    if (policyMatch) {
      const appId = decodeURIComponent(policyMatch[1]);
      if (method === 'POST') {
        return response({ ...EXACT_POLICY, id: 'created-policy' });
      }
      return response(policiesByApp[appId] || []);
    }

    throw new Error(`Unexpected Cloudflare fixture request: ${method} ${parsed.pathname}`);
  };
  return { fetchImpl, calls };
}

function input(fetchImpl, mode = 'check') {
  return {
    fetchImpl,
    mode,
    accountId: 'account-1',
    apiToken: 'admin-token',
    workersApiToken: 'worker-read-token',
    targetUrl: TARGET,
    serviceClientId: TOKEN.client_id,
  };
}

describe('ProofMode provider scope hardening', () => {
  it('verifies preview Worker identity through supported account and script subdomain endpoints', async () => {
    const app = {
      id: 'app-preview',
      name: 'Chief immutable previews',
      destinations: [{ type: 'preview_worker', worker_id: WORKER_ID }],
    };
    const { fetchImpl, calls } = cloudflareFixture({
      apps: [app],
      policiesByApp: { [app.id]: [EXACT_POLICY] },
    });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl))).resolves.toMatchObject({
      state: 'configured',
      changed: false,
      appId: app.id,
      scope: 'preview_worker',
      serviceTokenId: TOKEN.id,
    });

    expect(calls.some((call) => call.path.endsWith('/workers/subdomain'))).toBe(true);
    expect(calls.some((call) => call.path.endsWith('/workers/scripts/chief-ai/subdomain'))).toBe(true);
  });

  it('refuses automatic repair when a preview_worker application contains another destination', async () => {
    const app = {
      id: 'app-preview-multi',
      name: 'Chief preview plus unrelated destination',
      destinations: [
        { type: 'preview_worker', worker_id: WORKER_ID },
        { type: 'public', uri: 'unrelated.example.com' },
      ],
    };
    const { fetchImpl, calls } = cloudflareFixture({ apps: [app] });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl, 'repair'))).rejects.toThrow(
      /Effective Access scope preview_worker_multi_destination .* Refusing automatic repair/,
    );
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('refuses account-wide certification when the target Worker is absent from the configured account', async () => {
    const app = {
      id: 'app-all-preview',
      name: 'Protect all Worker previews',
      destinations: [{ type: 'all_preview_workers' }],
    };
    const { fetchImpl } = cloudflareFixture({
      apps: [app],
      workers: [],
      policiesByApp: { [app.id]: [EXACT_POLICY] },
    });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl))).rejects.toThrow(
      /Expected exactly one Cloudflare Worker named chief-ai; found 0/,
    );
  });

  it('refuses account-wide certification when the account workers.dev subdomain does not match the target', async () => {
    const app = {
      id: 'app-all-preview',
      name: 'Protect all Worker previews',
      destinations: [{ type: 'all_preview_workers' }],
    };
    const { fetchImpl } = cloudflareFixture({
      apps: [app],
      accountSubdomain: 'different-account',
      policiesByApp: { [app.id]: [EXACT_POLICY] },
    });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl))).rejects.toThrow(
      /does not match target chief-ai\.mcgill-raylene\.workers\.dev/,
    );
  });
});
