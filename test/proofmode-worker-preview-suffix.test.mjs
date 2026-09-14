import { describe, expect, it } from 'vitest';
import { ensureProofModeAccessPolicy } from '../scripts/proofmode-access-policy.mjs';

const TARGET = 'https://1234abcd-chief-ai.mcgill-raylene.workers.dev';
const WORKER_ID = 'c81a2d22c29840ed9d61681a3270dbff';
const TOKEN = { id: 'token-1', client_id: 'client-1', enabled: true };
const APP = {
  id: 'app-preview-worker',
  name: 'renamed-access-app',
  destinations: [{ type: 'preview_worker', worker_id: WORKER_ID }],
};
const POLICY = {
  id: 'policy-1',
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

describe('Cloudflare Worker preview suffix binding', () => {
  it('accepts Cloudflare canonical preview_url_suffix with its leading hyphen', async () => {
    const fetchImpl = async (url) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/access/service_tokens')) return response([TOKEN]);
      if (parsed.pathname.endsWith('/access/apps')) return response([APP]);
      if (parsed.pathname.endsWith('/workers/workers')) {
        return response([{
          id: WORKER_ID,
          name: 'chief-ai',
          subdomain: {
            previews_enabled: true,
            preview_url_suffix: '-chief-ai.mcgill-raylene.workers.dev',
          },
        }]);
      }
      if (parsed.pathname.endsWith(`/access/apps/${APP.id}/policies`)) return response([POLICY]);
      throw new Error(`Unexpected Cloudflare test request: ${parsed.pathname}`);
    };

    await expect(ensureProofModeAccessPolicy({
      fetchImpl,
      mode: 'check',
      accountId: 'account-1',
      apiToken: 'admin-token',
      targetUrl: TARGET,
      serviceClientId: TOKEN.client_id,
      accessAppId: APP.id,
    })).resolves.toMatchObject({
      state: 'configured',
      changed: false,
      appId: APP.id,
      scope: 'preview_worker',
      serviceTokenId: TOKEN.id,
    });
  });
});
