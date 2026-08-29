import { describe, expect, it, vi } from 'vitest';
import { ensureProofModeAccessPolicy } from './proofmode-access-policy.mjs';

const ACCOUNT = 'account-1';
const APP = 'app-1';
const SERVICE = 'service-token-1';
const ADMIN = 'admin-token';

function response(result, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return { success: status >= 200 && status < 300, result, errors: [] };
    },
  };
}

const args = {
  mode: 'check',
  accountId: ACCOUNT,
  apiToken: ADMIN,
  accessAppId: APP,
  serviceTokenId: SERVICE,
};

describe('ProofMode Cloudflare Access service-auth bootstrap', () => {
  it('accepts an existing specific Service Auth policy without mutation', async () => {
    const fetchImpl = vi.fn(async () => response([{
      id: 'policy-1',
      name: 'Existing CI policy',
      decision: 'non_identity',
      include: [{ service_token: { token_id: SERVICE } }],
    }]));

    await expect(ensureProofModeAccessPolicy({ ...args, fetchImpl })).resolves.toEqual({
      state: 'configured',
      changed: false,
      policyId: 'policy-1',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed in check mode when the specific service token is not authorized', async () => {
    const fetchImpl = vi.fn(async () => response([]));

    await expect(ensureProofModeAccessPolicy({ ...args, fetchImpl })).rejects.toThrow(
      'No matching Cloudflare Access Service Auth policy exists',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('creates only a specific non-identity Service Auth policy in repair mode', async () => {
    const fetchImpl = vi.fn(async (_url, init = {}) => {
      if (!init.method) return response([]);
      const body = JSON.parse(init.body);
      expect(init.method).toBe('POST');
      expect(body).toEqual({
        name: 'ProofMode CI service auth',
        decision: 'non_identity',
        include: [{ service_token: { token_id: SERVICE } }],
      });
      expect(body.decision).not.toBe('bypass');
      expect(body.include[0]).not.toHaveProperty('any_valid_service_token');
      return response({ id: 'policy-new', ...body });
    });

    await expect(ensureProofModeAccessPolicy({ ...args, mode: 'repair', fetchImpl })).resolves.toEqual({
      state: 'configured',
      changed: true,
      policyId: 'policy-new',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refuses to overwrite a conflicting named policy', async () => {
    const fetchImpl = vi.fn(async () => response([{
      id: 'policy-wrong',
      name: 'ProofMode CI service auth',
      decision: 'allow',
      include: [{ email: { email: 'someone@example.com' } }],
    }]));

    await expect(ensureProofModeAccessPolicy({ ...args, mode: 'repair', fetchImpl })).rejects.toThrow(
      'Refusing to overwrite it automatically',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not leak the admin token into request URLs or bodies', async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return response([{
        id: 'policy-1',
        decision: 'non_identity',
        include: [{ service_token: { token_id: SERVICE } }],
      }]);
    });

    await ensureProofModeAccessPolicy({ ...args, fetchImpl });
    expect(calls[0].url).not.toContain(ADMIN);
    expect(calls[0].init.body || '').not.toContain(ADMIN);
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${ADMIN}`);
  });
});
