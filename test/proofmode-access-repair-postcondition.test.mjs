import { describe, expect, it } from 'vitest';
import { ensureProofModeAccessPolicy } from '../scripts/proofmode-access-policy.mjs';

const TARGET = 'https://1234abcd-chief-ai.mcgill-raylene.workers.dev';
const HOST = '1234abcd-chief-ai.mcgill-raylene.workers.dev';
const WORKER_ID = 'worker-chief-ai';
const TOKEN = { id: 'service-token-1', client_id: 'client-id.access', enabled: true };
const CREATED = {
  id: 'created-policy',
  name: 'ProofMode CI service auth',
  decision: 'non_identity',
  include: [{ service_token: { token_id: TOKEN.id } }],
};

function response(result) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        success: true,
        result,
        errors: [],
        result_info: { page: 1, per_page: 100, total_pages: 1 },
      };
    },
  };
}

function repairFixture({ postReadPolicies }) {
  let policyReads = 0;
  let posts = 0;
  const fetchImpl = async (url, init = {}) => {
    const parsed = new globalThis.URL(url);
    const method = init.method || 'GET';

    if (parsed.pathname.endsWith('/access/service_tokens')) return response([TOKEN]);
    if (parsed.pathname.endsWith('/access/apps')) {
      return response([{
        id: 'app-exact',
        name: 'Chief immutable preview',
        destinations: [{ type: 'public', uri: `${HOST}/*` }],
      }]);
    }
    if (parsed.pathname.endsWith('/workers/workers')) {
      return response([{ id: WORKER_ID, name: 'chief-ai' }]);
    }
    if (parsed.pathname.endsWith('/workers/subdomain')) {
      return response({ subdomain: 'mcgill-raylene' });
    }
    if (parsed.pathname.endsWith('/workers/scripts/chief-ai/subdomain')) {
      return response({ enabled: true, previews_enabled: true });
    }
    if (parsed.pathname.endsWith('/access/apps/app-exact/policies')) {
      if (method === 'POST') {
        posts += 1;
        return response(CREATED);
      }
      policyReads += 1;
      return response(policyReads === 1 ? [] : postReadPolicies);
    }

    throw new Error(`Unexpected request: ${method} ${parsed.pathname}`);
  };

  return {
    fetchImpl,
    counts: () => ({ policyReads, posts }),
  };
}

function input(fetchImpl) {
  return {
    fetchImpl,
    mode: 'repair',
    accountId: 'account-1',
    apiToken: 'admin-token',
    workersApiToken: 'worker-read-token',
    targetUrl: TARGET,
    serviceClientId: TOKEN.client_id,
    nowMs: Date.parse('2026-09-13T00:00:00Z'),
  };
}

describe('ProofMode Access repair postcondition', () => {
  it('re-reads provider state and returns the persisted exact policy', async () => {
    const fixture = repairFixture({ postReadPolicies: [CREATED] });

    await expect(ensureProofModeAccessPolicy(input(fixture.fetchImpl))).resolves.toMatchObject({
      state: 'configured',
      changed: true,
      appId: 'app-exact',
      policyId: CREATED.id,
      scope: 'public_exact_host',
      serviceTokenId: TOKEN.id,
    });
    expect(fixture.counts()).toEqual({ policyReads: 2, posts: 1 });
  });

  it('fails closed when a concurrent parallel grant appears after policy creation', async () => {
    const fixture = repairFixture({
      postReadPolicies: [
        CREATED,
        {
          id: 'parallel-policy',
          decision: 'non_identity',
          include: [{ any_valid_service_token: {} }],
        },
      ],
    });

    await expect(ensureProofModeAccessPolicy(input(fixture.fetchImpl))).rejects.toThrow(
      'Cloudflare repair postcondition observed a parallel Service Auth or bypass grant after creation',
    );
    expect(fixture.counts()).toEqual({ policyReads: 2, posts: 1 });
  });
});
