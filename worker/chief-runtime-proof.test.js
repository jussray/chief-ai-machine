import { describe, expect, it, vi } from 'vitest';
import httpWorker from './http-worker.js';

const URL = 'https://chief.example/api/chief/runtime-proof';
const TEST_TOKEN = 'runtime-proof-test-token-0123456789-strong';

function request(token) {
  return new Request(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ provider: 'openai' }),
  });
}

describe('Chief runtime proof authorization', () => {
  it('rejects missing and wrong bearer tokens without invoking any provider', async () => {
    const env = {
      CHIEF_RUNTIME_PROOF_TOKEN: TEST_TOKEN,
      OPENAI_API_KEY: 'not-an-authorized-test-provider-key',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    try {
      const missing = await httpWorker.fetch(request(null), env);
      const wrong = await httpWorker.fetch(request('wrong-but-long-enough-token-0123456789'), env);
      expect(missing.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('requires a sufficiently strong server-held token even when supplied by the caller', async () => {
    const response = await httpWorker.fetch(request('weak'), {
      CHIEF_RUNTIME_PROOF_TOKEN: 'weak',
    });
    expect(response.status).toBe(401);
  });

  it('requires a baked artifact identity rather than trusting caller-overridable runtime SHA', async () => {
    const response = await httpWorker.fetch(request(TEST_TOKEN), {
      CHIEF_RUNTIME_PROOF_TOKEN: TEST_TOKEN,
      RELEASE_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error).toBe('release_identity_unavailable');
  });
});
