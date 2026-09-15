import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('legacy relay retirement Playwright contract', () => {
  it('keeps the retired v1 runtime and browser proof aligned', async () => {
    const [runtime, playwright, workflow] = await Promise.all([
      read('worker/federated-relay.js'),
      read('e2e/federated-relay.pw.mjs'),
      read('.github/workflows/proofmode-mcp-playwright.yml'),
    ]);

    expect(runtime).toContain("error: 'relay_v1_retired'");
    expect(runtime).toContain("replacement: '/api/federated-relay/v3'");
    expect(runtime).toMatch(/\},\s*410\);/);
    expect(runtime).toContain('executionAuthorized: false');
    expect(runtime).toContain('authorityTransferred: false');
    expect(runtime).toContain('approvalCarriedForward: false');

    expect(playwright).toContain('expect(response.status()).toBe(410)');
    expect(playwright).toContain("error: 'relay_v1_retired'");
    expect(playwright).toContain("replacement: '/api/federated-relay/v3'");
    expect(playwright).toContain("expect(body).not.toHaveProperty('receipt')");
    expect(playwright).toContain("expect(body).not.toHaveProperty('replyEnvelope')");
    expect(playwright).not.toContain('expect(response.status()).toBe(200)');
    expect(playwright).not.toContain("status: 'accepted'");

    expect(workflow).toContain('"e2e/federated-relay.pw.mjs"');
    expect(workflow).toMatch(/testMatch:\s*\/\(proofmode-mcp\|federated-relay\)/);
  });
});
