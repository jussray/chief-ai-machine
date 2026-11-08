import { describe, expect, it, vi } from 'vitest';
import { proofmodeAccessHeaders, proofmodeRequest } from '../scripts/proofmode-access-client.mjs';

const base = 'https://chief-ai.mcgill-raylene.workers.dev';
const env = { CLOUDFLARE_ACCESS_CLIENT_ID: 'fixture-id.access', CLOUDFLARE_ACCESS_CLIENT_SECRET: 'fixture-secret' };

describe('Chief protected proof HTTP client', () => {
  it('supports credential-free local proof without granting production authority', () => {
    expect(proofmodeAccessHeaders({}, 'http://127.0.0.1:8791')).toEqual({});
    expect(() => proofmodeAccessHeaders({}, base, true)).toThrow('PROOFMODE_ACCESS_CREDENTIALS_REQUIRED');
  });
  it('requires a complete well-formed credential pair', () => {
    expect(() => proofmodeAccessHeaders({ CLOUDFLARE_ACCESS_CLIENT_ID: 'fixture-id' }, base)).toThrow('PROOFMODE_ACCESS_CREDENTIALS_REQUIRED');
    expect(() => proofmodeAccessHeaders({ ...env, CLOUDFLARE_ACCESS_CLIENT_SECRET: 'bad\nvalue' }, base)).toThrow('PROOFMODE_ACCESS_CREDENTIALS_REQUIRED');
  });
  it.each([base, 'https://6dbdceef-chief-ai.mcgill-raylene.workers.dev'])('accepts the Chief origin %s', (origin) => {
    expect(proofmodeAccessHeaders(env, origin)['CF-Access-Client-Secret']).toBe('fixture-secret');
  });
  it.each(['https://example.com', 'http://chief-ai.mcgill-raylene.workers.dev', base + '.example.com', base + '/unapproved', 'https://user:password@chief-ai.mcgill-raylene.workers.dev', base + ':8443'])('refuses to send credentials to %s', (origin) => {
    expect(() => proofmodeAccessHeaders(env, origin)).toThrow('PROOFMODE_ACCESS_ORIGIN_REJECTED');
  });
  it('sends the same scoped headers to version and MCP, without following redirects', async () => {
    const request = { fetch: vi.fn(async () => ({ status: () => 302 })) };
    for (const path of ['/version', '/mcp']) {
      await proofmodeRequest(request, base, path, env);
      const options = request.fetch.mock.calls.at(-1)[1];
      expect(options.maxRedirects).toBe(0);
      expect(options.headers['CF-Access-Client-Secret']).toBe('fixture-secret');
    }
  });
  it('does not expose credential-bearing transport diagnostics', async () => {
    const request = { fetch: async () => { throw new Error('fixture-secret'); } };
    await expect(proofmodeRequest(request, base, '/mcp', env)).rejects.toThrow('PROOFMODE_HTTP_REQUEST_FAILED');
    await expect(proofmodeRequest(request, base, '/unapproved', env)).rejects.toThrow('PROOFMODE_ACCESS_PATH_REJECTED');
  });
});
