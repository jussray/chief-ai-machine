import { describe, expect, it, vi } from 'vitest';
import { ensureProofModeAccessPolicy } from '../scripts/proofmode-access-policy.mjs';

const ACCOUNT = 'account-1';
const ADMIN = 'admin-token';
const CLIENT_ID = 'client-id.access';
const SERVICE_ID = 'service-token-1';
const TARGET = 'https://5a188322-chief-ai.mcgill-raylene.workers.dev';
const HOST = '5a188322-chief-ai.mcgill-raylene.workers.dev';

function response(result) {
  return {
    status: 200,
    ok: true,
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

function routeFetch({ apps, policies = [] }) {
  return vi.fn(async (url) => {
    const parsed = new globalThis.URL(url);
    if (parsed.pathname.endsWith('/access/service_tokens')) {
      return response([{
        id: SERVICE_ID,
        client_id: CLIENT_ID,
        enabled: true,
        expires_at: '2027-09-05T00:00:00Z',
      }]);
    }
    if (parsed.pathname.endsWith('/access/apps')) return response(apps);
    if (parsed.pathname.endsWith('/policies')) return response(policies);
    throw new Error(`Unexpected request: ${url}`);
  });
}

const args = {
  mode: 'check',
  accountId: ACCOUNT,
  apiToken: ADMIN,
  targetUrl: TARGET,
  serviceClientId: CLIENT_ID,
  applicationName: 'chief-ai - Cloudflare Workers',
  nowMs: Date.parse('2026-09-05T06:00:00Z'),
};

describe('ProofMode Access hardening', () => {
  it('rejects a mixed Service Auth include set that also admits broader service tokens', async () => {
    const app = {
      id: 'app-exact',
      name: 'ProofMode exact immutable preview',
      destinations: [{ type: 'public', uri: `${HOST}/*` }],
    };
    const fetchImpl = routeFetch({
      apps: [app],
      policies: [{
        id: 'policy-mixed',
        decision: 'non_identity',
        include: [
          { service_token: { token_id: SERVICE_ID } },
          { any_valid_service_token: {} },
        ],
      }],
    });

    await expect(ensureProofModeAccessPolicy({ ...args, fetchImpl })).rejects.toThrow(
      'parallel Service Auth or bypass grant',
    );
  });

  it('rejects exact service-token includes when require or exclude adds another condition', async () => {
    const app = {
      id: 'app-exact',
      name: 'ProofMode exact immutable preview',
      destinations: [{ type: 'public', uri: `${HOST}/*` }],
    };

    for (const extraSelectors of [
      { require: [{ email_domain: { domain: 'example.com' } }] },
      { exclude: [{ service_token: { token_id: SERVICE_ID } }] },
    ]) {
      const fetchImpl = routeFetch({
        apps: [app],
        policies: [{
          id: 'policy-conditioned',
          decision: 'non_identity',
          include: [{ service_token: { token_id: SERVICE_ID } }],
          ...extraSelectors,
        }],
      });

      await expect(ensureProofModeAccessPolicy({ ...args, fetchImpl })).rejects.toThrow(
        'parallel Service Auth or bypass grant',
      );
    }
  });

  it('rejects an Everyone bypass even when the exact service-token policy also exists', async () => {
    const app = {
      id: 'app-exact',
      name: 'ProofMode exact immutable preview',
      destinations: [{ type: 'public', uri: `${HOST}/*` }],
    };
    const fetchImpl = routeFetch({
      apps: [app],
      policies: [
        {
          id: 'policy-exact',
          decision: 'non_identity',
          include: [{ service_token: { token_id: SERVICE_ID } }],
        },
        {
          id: 'policy-bypass',
          decision: 'bypass',
          include: [{ everyone: {} }],
        },
      ],
    });

    await expect(ensureProofModeAccessPolicy({ ...args, fetchImpl })).rejects.toThrow(
      'Everyone/Bypass policy',
    );
  });

  it('rejects any parallel non-identity or bypass grant beside the exact service-token policy', async () => {
    const app = {
      id: 'app-exact',
      name: 'ProofMode exact immutable preview',
      destinations: [{ type: 'public', uri: `${HOST}/*` }],
    };

    for (const parallelPolicy of [
      {
        id: 'policy-any-token',
        decision: 'non_identity',
        include: [{ any_valid_service_token: {} }],
      },
      {
        id: 'policy-other-token',
        decision: 'non_identity',
        include: [{ service_token: { token_id: 'service-token-2' } }],
      },
      {
        id: 'policy-ip-bypass',
        decision: 'bypass',
        include: [{ ip: { ip: '203.0.113.0/24' } }],
      },
    ]) {
      const fetchImpl = routeFetch({
        apps: [app],
        policies: [
          {
            id: 'policy-exact',
            decision: 'non_identity',
            include: [{ service_token: { token_id: SERVICE_ID } }],
          },
          parallelPolicy,
        ],
      });

      await expect(ensureProofModeAccessPolicy({ ...args, fetchImpl })).rejects.toThrow(
        'parallel Service Auth or bypass grant',
      );
    }
  });

  it('rejects parallel grant policies before repair instead of creating another grant', async () => {
    const app = {
      id: 'app-exact',
      name: 'ProofMode exact immutable preview',
      destinations: [{ type: 'public', uri: `${HOST}/*` }],
    };
    const fetchImpl = routeFetch({
      apps: [app],
      policies: [{
        id: 'policy-other-token',
        decision: 'non_identity',
        include: [{ service_token: { token_id: 'service-token-2' } }],
      }],
    });

    await expect(ensureProofModeAccessPolicy({ ...args, mode: 'repair', fetchImpl })).rejects.toThrow(
      'parallel Service Auth or bypass grant',
    );
  });

  it('rejects required paths that resolve to different public Access applications', async () => {
    const versionApp = {
      id: 'app-version',
      name: 'Version only',
      destinations: [{ type: 'public', uri: `${HOST}/version` }],
    };
    const mcpApp = {
      id: 'app-mcp',
      name: 'MCP only',
      destinations: [{ type: 'public', uri: `${HOST}/mcp` }],
    };
    const fetchImpl = routeFetch({ apps: [versionApp, mcpApp] });

    await expect(ensureProofModeAccessPolicy({ ...args, fetchImpl })).rejects.toThrow(
      'Multiple public Access applications match required ProofMode paths',
    );
  });

  it('preserves path case when resolving public Access coverage', async () => {
    const uppercaseOnly = {
      id: 'app-uppercase',
      name: 'Uppercase paths only',
      destinations: [
        { type: 'public', uri: `${HOST}/VERSION` },
        { type: 'public', uri: `${HOST}/MCP` },
      ],
    };
    const fetchImpl = routeFetch({ apps: [uppercaseOnly] });

    await expect(ensureProofModeAccessPolicy({ ...args, fetchImpl })).rejects.toThrow(
      'Could not resolve a Worker-specific or account-wide Access application',
    );
  });

  it('rejects alternate ports on immutable preview targets before provider access', async () => {
    const fetchImpl = vi.fn();

    await expect(ensureProofModeAccessPolicy({
      ...args,
      targetUrl: `${TARGET}:8443/`,
      fetchImpl,
    })).rejects.toThrow(
      'PROOFMODE_ACCESS_TARGET_URL must be the origin of one immutable Chief workers.dev preview',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects mixed public and Worker coverage instead of assuming one effective app', async () => {
    const versionApp = {
      id: 'app-version',
      name: 'Version only',
      destinations: [{ type: 'public', uri: `${HOST}/version` }],
    };
    const workerApp = {
      id: 'worker-app',
      name: 'chief-ai - Cloudflare Workers',
      destinations: [{ type: 'preview_worker', worker_id: 'worker-1' }],
    };
    const fetchImpl = routeFetch({ apps: [versionApp, workerApp] });

    await expect(ensureProofModeAccessPolicy({ ...args, fetchImpl })).rejects.toThrow(
      'Public Access application coverage differs across required ProofMode paths',
    );
  });
});
