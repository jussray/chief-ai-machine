import { describe, expect, it } from 'vitest';
import { handleFederatedRelay } from './federated-relay.js';

function post(body = {}) {
  return new Request('https://chief-ai.example/api/federated-relay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function expectRetired(body = {}) {
  const response = await handleFederatedRelay(post(body));
  expect(response.status).toBe(410);

  const payload = await response.json();
  expect(payload).toMatchObject({
    error: 'relay_v1_retired',
    replacement: '/api/federated-relay/v3',
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
  });
  expect(payload).not.toHaveProperty('receipt');
  expect(payload).not.toHaveProperty('replyEnvelope');
  expect(payload).not.toHaveProperty('successorProofCookie');
}

describe('Chief legacy federated relay v1 retirement', () => {
  it('fails closed and mints no continuity or authority receipt', async () => {
    await expectRetired({
      contract: 'juss/federated-agent-relay@v1',
      messageId: 'q4msg:fcr-to-chief:0001',
      from: 'founder-control-room',
      to: 'chief-ai-machine',
    });
  });

  it('cannot be revived by authority-shaped or impersonation payloads', async () => {
    await expectRetired({ executionAuthorized: true, founderApproval: true });
    await expectRetired({
      sourceRepository: 'jussray/promptos',
      sourceBranch: 'main',
      targetRepository: 'jussray/chief-ai-machine',
    });
  });

  it('rejects non-POST methods separately from the retirement response', async () => {
    const response = await handleFederatedRelay(
      new Request('https://chief-ai.example/api/federated-relay', { method: 'GET' }),
    );
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({ error: 'Method not allowed' });
  });
});
