import { describe, expect, it, vi } from 'vitest';
import {
  BROWSER_REALITY_MAX_REDIRECTS,
  assertBrowserRealityPublicTarget,
  assertBrowserRealityRedirectBudget,
  isPublicBrowserRealityAddress,
} from '../src/domain/browser-reality-network.js';

describe('Browser Reality public-network admission', () => {
  it('admits only public HTTP(S) targets after DNS resolution', async () => {
    const resolveHost = vi.fn(async (hostname) => {
      expect(hostname).toBe('example.com');
      return ['8.8.8.8', '2606:4700:4700::1111'];
    });

    await expect(assertBrowserRealityPublicTarget('https://example.com/path?q=1', resolveHost))
      .resolves.toEqual({
        url: 'https://example.com/path?q=1',
        hostname: 'example.com',
        resolvedAddresses: ['8.8.8.8', '2606:4700:4700::1111'],
      });
    expect(resolveHost).toHaveBeenCalledTimes(1);
  });

  it('rejects local, metadata, private, link-local, reserved, and documentation destinations', async () => {
    const resolver = vi.fn(async () => ['8.8.8.8']);
    const blockedTargets = [
      'http://localhost/',
      'http://sub.localhost/',
      'http://metadata.google.internal/',
      'http://service.internal/',
      'http://printer.local/',
      'http://127.0.0.1/',
      'http://10.0.0.7/',
      'http://169.254.169.254/latest/meta-data/',
      'http://172.16.0.1/',
      'http://192.168.1.1/',
      'http://100.64.0.1/',
      'http://192.0.2.1/',
      'http://198.51.100.2/',
      'http://203.0.113.3/',
      'http://[::1]/',
      'http://[fd00::1]/',
      'http://[fe80::1]/',
      'http://[2001:db8::1]/',
    ];

    for (const target of blockedTargets) {
      await expect(assertBrowserRealityPublicTarget(target, resolver)).rejects.toThrow(/not public|non-public/);
    }
  });

  it('fails closed when any DNS answer is non-public', async () => {
    await expect(assertBrowserRealityPublicTarget(
      'https://public-looking.example/',
      async () => ['8.8.8.8', '10.1.2.3'],
    )).rejects.toThrow(/non-public/);

    await expect(assertBrowserRealityPublicTarget(
      'https://empty.example/',
      async () => [],
    )).rejects.toThrow(/did not resolve/);
  });

  it('rejects credential-bearing URLs, non-web schemes, and unexpected service ports', async () => {
    const resolver = async () => ['8.8.8.8'];

    await expect(assertBrowserRealityPublicTarget('https://user:secret@example.com/', resolver))
      .rejects.toThrow(/must not contain URL credentials/);
    await expect(assertBrowserRealityPublicTarget('file:///etc/passwd', resolver))
      .rejects.toThrow(/must use http or https/);
    await expect(assertBrowserRealityPublicTarget('https://example.com:8443/', resolver))
      .rejects.toThrow(/port 8443 is not allowed/);
  });

  it('classifies public and non-public addresses deterministically', () => {
    expect(isPublicBrowserRealityAddress('8.8.8.8')).toBe(true);
    expect(isPublicBrowserRealityAddress('2606:4700:4700::1111')).toBe(true);
    expect(isPublicBrowserRealityAddress('127.0.0.1')).toBe(false);
    expect(isPublicBrowserRealityAddress('169.254.169.254')).toBe(false);
    expect(isPublicBrowserRealityAddress('::1')).toBe(false);
    expect(isPublicBrowserRealityAddress('fd00::1')).toBe(false);
    expect(isPublicBrowserRealityAddress('2001:db8::1')).toBe(false);
  });

  it('enforces a bounded redirect chain', () => {
    expect(BROWSER_REALITY_MAX_REDIRECTS).toBe(5);
    expect(assertBrowserRealityRedirectBudget(0)).toBe(0);
    expect(assertBrowserRealityRedirectBudget(5)).toBe(5);
    expect(() => assertBrowserRealityRedirectBudget(6)).toThrow(/redirect budget exceeded/);
    expect(() => assertBrowserRealityRedirectBudget(-1)).toThrow(/non-negative integer/);
  });
});
