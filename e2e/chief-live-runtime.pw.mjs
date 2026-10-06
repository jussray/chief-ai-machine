import { expect, test } from '@playwright/test';

const baseUrl = String(process.env.CHIEF_RUNTIME_PROOF_BASE_URL || '').replace(/\/$/, '');
const token = String(process.env.CHIEF_RUNTIME_PROOF_TOKEN || '');
const expectedSha = String(process.env.EXPECTED_HEAD_SHA || '').toLowerCase();
const provider = String(process.env.CHIEF_RUNTIME_PROOF_PROVIDER || 'openai').toLowerCase();
const evidenceProvider = provider === 'muse' ? 'meta' : provider;

test('deployed Chief proves exact release and real provider provenance', async ({ page }) => {
  expect(baseUrl).toMatch(/^https:\/\//);
  expect(token.length).toBeGreaterThan(0);
  expect(expectedSha).toMatch(/^[0-9a-f]{40}$/);
  expect(provider).toMatch(/^(openai|anthropic|muse)$/);

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

  const identity = await page.evaluate(async () => {
    const response = await fetch('/api/chief/runtime-identity', { cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  });

  expect(identity.status).toBe(200);
  expect(identity.body.ok).toBe(true);
  expect(identity.body.service).toBe('chief-ai');
  expect(identity.body.release_sha).toBe(expectedSha);
  expect(identity.body.providers?.[provider]?.state).not.toBe('ABSENT');

  const proof = await page.evaluate(async ({ proofToken, selectedProvider }) => {
    const response = await fetch('/api/chief/runtime-proof', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${proofToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider: selectedProvider }),
    });
    return { status: response.status, body: await response.json() };
  }, { proofToken: token, selectedProvider: provider });

  expect(proof.status).toBe(200);
  expect(proof.body).toMatchObject({
    ok: true,
    service: 'chief-ai',
    release_sha: expectedSha,
    provider,
    provider_state: 'VERIFIED',
  });
  expect(proof.body.response_id).toMatch(/^[A-Za-z0-9._:-]+$/);
  expect(proof.body.evidence_ref).toBe(`provider:${evidenceProvider}:${proof.body.response_id}`);
  expect(proof.body.text).toBeUndefined();
});
