import { describe, expect, it } from 'vitest';
import { ensureProofModeAccessPolicy } from '../scripts/proofmode-access-policy.mjs';

const HOST = '1234abcd-chief-ai.mcgill-raylene.workers.dev';
const WORKER = 'chief-worker-1';
const APP = 'chief-preview-app';
const TAG = { key: 'purpose', value: 'chief-ai-immutable-preview-proof-v1' };
const TOKEN = {
  id: 'token-1',
  client_id: 'test-client.access',
  enabled: true,
  tags: { purpose: TAG.value },
};
const TAG_POLICY = {
  id: 'tag-policy-1',
  name: 'Chief exact-head CI temporary Service Auth',
  decision: 'non_identity',
  include: [{ service_token_tag: TAG }],
};
const MEMBER_POLICY = {
  id: 'human-policy-1',
  name: 'Allow emails',
  decision: 'allow',
  include: [{ email: { email: 'founder@example.com' } }],
};

function response(result) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, result, result_info: { total_pages: 1 } }),
  };
}

function fixture({ tokens = [TOKEN], policies = [MEMBER_POLICY, TAG_POLICY], scope = 'preview_worker' } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method || 'GET';
    calls.push({ method, path: parsed.pathname });
    if (parsed.pathname.endsWith('/access/service_tokens')) return response(tokens);
    if (parsed.pathname.endsWith('/access/apps')) {
      return response([{ id: APP, name: 'Chief previews', destinations: [{
        type: scope, worker_id: WORKER,
      }] }]);
    }
    if (parsed.pathname.endsWith('/workers/workers')) return response([{ id: WORKER, name: 'chief-ai' }]);
    if (parsed.pathname.endsWith('/workers/subdomain')) return response({ subdomain: 'mcgill-raylene' });
    if (parsed.pathname.endsWith('/workers/scripts/chief-ai/subdomain')) {
      return response({ enabled: true, previews_enabled: true });
    }
    if (parsed.pathname.endsWith('/access/apps/' + APP + '/policies')) return response(policies);
    throw new Error('Unexpected provider API request: ' + method + ' ' + parsed.pathname);
  };
  return { calls, fetchImpl };
}

function input(fetchImpl, mode = 'check') {
  return {
    fetchImpl,
    mode,
    accountId: 'account-1',
    apiToken: 'test-admin-token',
    targetUrl: 'https://' + HOST,
    serviceClientId: TOKEN.client_id,
    accessAppId: APP,
  };
}

describe('Chief preview tag-scoped service authentication', () => {
  it('certifies a single pinned-tag token in a preview-only app, preserving human access', async () => {
    const f = fixture();
    await expect(ensureProofModeAccessPolicy(input(f.fetchImpl))).resolves.toMatchObject({
      state: 'configured', changed: false, appId: APP,
      policyId: TAG_POLICY.id, scope: 'preview_worker',
      serviceTokenId: TOKEN.id,
    });
    expect(f.calls.every(call => call.method === 'GET')).toBe(true);
  });

  it('does not create a duplicate Service Auth grant on repair of a valid tagged policy', async () => {
    const f = fixture();
    await expect(ensureProofModeAccessPolicy(input(f.fetchImpl, 'repair')))
      .resolves.toMatchObject({ state: 'configured', changed: false });
    expect(f.calls.every(call => call.method === 'GET')).toBe(true);
  });

  it('fails closed when the configured service token lacks the approved tag', async () => {
    const f = fixture({ tokens: [{ ...TOKEN, tags: {} }] });
    await expect(ensureProofModeAccessPolicy(input(f.fetchImpl))).rejects.toThrow(
      'parallel Service Auth or bypass grant',
    );
    expect(f.calls.every(call => call.method === 'GET')).toBe(true);
  });

  it('rejects another token with the same tag, because tagged policy is not exclusive', async () => {
    const f = fixture({ tokens: [TOKEN, { ...TOKEN, id: 'other-token', client_id: 'other.access' }] });
    await expect(ensureProofModeAccessPolicy(input(f.fetchImpl))).rejects.toThrow(
      'parallel Service Auth or bypass grant',
    );
  });

  it('rejects tag grants with additional include selectors or conditions', async () => {
    for (const wrong of [
      { ...TAG_POLICY, include: [...TAG_POLICY.include, { any_valid_service_token: {} }] },
      { ...TAG_POLICY, require: [{ ip: { ip: '192.0.2.0/24' } }] },
      { ...TAG_POLICY, include: [{ service_token_tag: { key: TAG.key, value: 'other-purpose' } }] },
      { ...TAG_POLICY, include: [{ service_token_tag: { ...TAG, unexpected: true } }] },
    ]) {
      const f = fixture({ policies: [MEMBER_POLICY, wrong] });
      await expect(ensureProofModeAccessPolicy(input(f.fetchImpl))).rejects.toThrow(
        'parallel Service Auth or bypass grant',
      );
    }
  });

  it('never certifies the tagged rule on the production Worker scope', async () => {
    const f = fixture({ scope: 'worker' });
    await expect(ensureProofModeAccessPolicy(input(f.fetchImpl))).rejects.toThrow(
      'parallel Service Auth or bypass grant',
    );
    expect(f.calls.every(call => call.method === 'GET')).toBe(true);
  });

  it('rejects parallel Service Auth or bypass grants even when the pinned tag is valid', async () => {
    for (const additional of [
      { decision: 'bypass', include: [{ everyone: {} }] },
      { decision: 'non_identity', include: [{ any_valid_service_token: {} }] },
    ]) {
      const f = fixture({ policies: [MEMBER_POLICY, TAG_POLICY, additional] });
      await expect(ensureProofModeAccessPolicy(input(f.fetchImpl))).rejects.toThrow();
      expect(f.calls.every(call => call.method === 'GET')).toBe(true);
    }
  });
});
