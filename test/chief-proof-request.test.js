import { describe, expect, it, vi } from 'vitest';
import { createChiefBoundRequest, chiefAccessHeaders } from '../scripts/chief-proof-request.mjs';

const origin = 'https://1234abcd-chief-ai.mcgill-raylene.workers.dev';
const credentials = {
  CLOUDFLARE_ACCESS_CLIENT_ID: 'mock-id',
  CLOUDFLARE_ACCESS_CLIENT_SECRET: 'mock-secret',
};
const mockClient = () => ({ get: vi.fn(async () => 'get'), post: vi.fn(async () => 'post') });

describe('Chief privileged proof request boundary', () => {
  it('only creates Access headers for a paired service token and approved Chief origin', () => {
    expect(chiefAccessHeaders(credentials, origin)).toEqual({
      'CF-Access-Client-Id': 'mock-id',
      'CF-Access-Client-Secret': 'mock-secret',
    });
    expect(chiefAccessHeaders({}, origin)).toEqual({});
    expect(() => chiefAccessHeaders({ CLOUDFLARE_ACCESS_CLIENT_ID: 'partial' }, origin)).toThrow();
    expect(() => chiefAccessHeaders(credentials, 'https://other.example')).toThrow();
    expect(() => chiefAccessHeaders(credentials, 'http://127.0.0.1:8789')).toThrow();
  });

  it('sends approved Chief URLs only and turns off redirects for both verbs', async () => {
    const client = mockClient();
    const bound = createChiefBoundRequest(client, origin);
    await bound.get(`${origin}/version`);
    await bound.post(`${origin}/mcp`, { headers: { Accept: 'application/json' }, data: { ok: true } });
    expect(client.get).toHaveBeenCalledWith(`${origin}/version`, { maxRedirects: 0 });
    expect(client.post).toHaveBeenCalledWith(`${origin}/mcp`, {
      headers: { Accept: 'application/json' }, data: { ok: true }, maxRedirects: 0,
    });
  });

  it('blocks foreign hosts, deceptive suffixes, credentials, and redirect opt-out', async () => {
    const client = mockClient();
    const bound = createChiefBoundRequest(client, origin);
    for (const url of [
      'https://other.example/mcp',
      'https://1234abcd-chief-ai.mcgill-raylene.workers.dev.attacker.example/mcp',
      'http://1234abcd-chief-ai.mcgill-raylene.workers.dev/mcp',
      'https://evil@1234abcd-chief-ai.mcgill-raylene.workers.dev/mcp',
      `${origin}/mcp?return=https://evil.example`,
    ]) {
      expect(() => bound.get(url)).toThrow();
    }
    expect(() => bound.get(`${origin}/version`, { maxRedirects: 2 })).toThrow();
    expect(() => bound.post(`${origin}/mcp`, { headers: { 'CF-Access-Client-Secret': 'overwrite' } })).toThrow();
    expect(client.get).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('restricts requests to Chief proof endpoints', () => {
    const bound = createChiefBoundRequest(mockClient(), origin);
    expect(() => bound.get(`${origin}/admin`)).toThrow();
    expect(() => bound.get(`${origin}/mcp/other`)).toThrow();
    expect(() => bound.get('https://other.example/version')).toThrow();
  });
});
