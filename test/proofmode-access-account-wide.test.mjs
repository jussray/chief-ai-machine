import { describe, expect, it } from 'vitest';
import { ensureProofModeAccessPolicy } from '../scripts/proofmode-access-policy.mjs';

const TARGET = 'https://1234abcd-chief-ai.mcgill-raylene.workers.dev';
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

function cloudflareFixture({ apps, policiesByApp = {} }) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET' });
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/access/service_tokens')) return response([TOKEN]);
    if (parsed.pathname.endsWith('/access/apps')) return response(apps);
    const policyMatch = parsed.pathname.match(/\/access\/apps\/([^/]+)\/policies$/);
    if (policyMatch) return response(policiesByApp[decodeURIComponent(policyMatch[1])] || []);
    throw new Error(`Unexpected Cloudflare fixture request: ${parsed.pathname}`);
  };
  return { fetchImpl, calls };
}

function input(fetchImpl, mode = 'check') {
  return {
    fetchImpl,
    mode,
    accountId: 'account-1',
    apiToken: 'admin-token',
    targetUrl: TARGET,
    serviceClientId: TOKEN.client_id,
  };
}

describe('ProofMode account-wide Cloudflare Access observation', () => {
  it('observes all_preview_workers as the effective preview scope in read-only check mode', async () => {
    const app = {
      id: 'app-all-preview',
      name: 'Protect all Worker previews',
      destinations: [{ type: 'all_preview_workers' }],
    };
    const { fetchImpl } = cloudflareFixture({
      apps: [app],
      policiesByApp: { [app.id]: [EXACT_POLICY] },
    });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl))).resolves.toMatchObject({
      state: 'configured',
      changed: false,
      appId: app.id,
      policyId: EXACT_POLICY.id,
      scope: 'all_preview_workers',
      serviceTokenId: TOKEN.id,
    });
  });

  it('observes all_workers as the account-wide fallback when no more specific Worker rule exists', async () => {
    const app = {
      id: 'app-all-workers',
      name: 'Protect all Workers',
      destinations: [{ type: 'all_workers' }],
    };
    const { fetchImpl } = cloudflareFixture({
      apps: [app],
      policiesByApp: { [app.id]: [EXACT_POLICY] },
    });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl))).resolves.toMatchObject({
      state: 'configured',
      changed: false,
      appId: app.id,
      policyId: EXACT_POLICY.id,
      scope: 'all_workers',
      serviceTokenId: TOKEN.id,
    });
  });

  it('refuses automatic repair on account-wide preview scope and never POSTs a policy', async () => {
    const app = {
      id: 'app-all-preview',
      name: 'Protect all Worker previews',
      destinations: [{ type: 'all_preview_workers' }],
    };
    const { fetchImpl, calls } = cloudflareFixture({ apps: [app] });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl, 'repair'))).rejects.toThrow(
      /Effective Access scope all_preview_workers .* Refusing automatic repair/,
    );
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('refuses automatic repair on all_workers scope and never POSTs a policy', async () => {
    const app = {
      id: 'app-all-workers',
      name: 'Protect all Workers',
      destinations: [{ type: 'all_workers' }],
    };
    const { fetchImpl, calls } = cloudflareFixture({ apps: [app] });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl, 'repair'))).rejects.toThrow(
      /Effective Access scope all_workers .* Refusing automatic repair/,
    );
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('keeps a specific preview_worker application ahead of account-wide preview protection', async () => {
    const apps = [
      {
        id: 'app-worker',
        name: 'chief-ai - Cloudflare Workers',
        destinations: [{ type: 'worker', worker_id: 'chief-ai' }],
      },
      {
        id: 'app-specific-preview',
        name: 'Chief preview override',
        destinations: [{ type: 'preview_worker', worker_id: 'chief-ai' }],
      },
      {
        id: 'app-all-preview',
        name: 'Protect all Worker previews',
        destinations: [{ type: 'all_preview_workers' }],
      },
    ];
    const { fetchImpl } = cloudflareFixture({
      apps,
      policiesByApp: { 'app-specific-preview': [EXACT_POLICY] },
    });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl))).resolves.toMatchObject({
      appId: 'app-specific-preview',
      scope: 'preview_worker',
      changed: false,
    });
  });

  it('keeps all_preview_workers ahead of all_workers for immutable preview traffic', async () => {
    const apps = [
      {
        id: 'app-all-workers',
        name: 'Protect all Workers',
        destinations: [{ type: 'all_workers' }],
      },
      {
        id: 'app-all-preview',
        name: 'Protect all Worker previews',
        destinations: [{ type: 'all_preview_workers' }],
      },
    ];
    const { fetchImpl } = cloudflareFixture({
      apps,
      policiesByApp: { 'app-all-preview': [EXACT_POLICY] },
    });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl))).resolves.toMatchObject({
      appId: 'app-all-preview',
      scope: 'all_preview_workers',
      changed: false,
    });
  });

  it('fails closed instead of guessing between duplicate all_preview_workers applications', async () => {
    const { fetchImpl } = cloudflareFixture({
      apps: [
        {
          id: 'app-all-preview-a',
          name: 'Protect all Worker previews A',
          destinations: [{ type: 'all_preview_workers' }],
        },
        {
          id: 'app-all-preview-b',
          name: 'Protect all Worker previews B',
          destinations: [{ type: 'all_preview_workers' }],
        },
      ],
    });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl))).rejects.toThrow(
      /Multiple all_preview_workers Access applications were observed/,
    );
  });

  it('fails closed instead of guessing between duplicate all_workers applications', async () => {
    const { fetchImpl } = cloudflareFixture({
      apps: [
        {
          id: 'app-all-workers-a',
          name: 'Protect all Workers A',
          destinations: [{ type: 'all_workers' }],
        },
        {
          id: 'app-all-workers-b',
          name: 'Protect all Workers B',
          destinations: [{ type: 'all_workers' }],
        },
      ],
    });

    await expect(ensureProofModeAccessPolicy(input(fetchImpl))).rejects.toThrow(
      /Multiple all_workers Access applications were observed/,
    );
  });
});
