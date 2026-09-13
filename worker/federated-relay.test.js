import { describe, expect, it } from 'vitest';
import { handleFederatedRelay } from './federated-relay.js';

const FCR_SHA = 'a'.repeat(40);
const CHIEF_SHA = 'b'.repeat(40);
const CONTEXT = 'c'.repeat(64);
const COOKIE = `Q4:v1:${'d'.repeat(64)}`;

function envelope(overrides = {}) {
  return {
    contract: 'juss/federated-agent-relay@v1',
    messageId: 'q4msg:fcr-to-chief:0001',
    from: 'founder-control-room',
    to: 'chief-ai-machine',
    sourceRepository: 'jussray/founder-control-room',
    sourceBranch: 'main',
    sourceHeadSha: FCR_SHA,
    targetRepository: 'jussray/chief-ai-machine',
    targetBranch: 'main',
    targetObservedHeadSha: CHIEF_SHA,
    subject: 'Current-goal evidence handoff',
    payload: 'Reconcile this evidence against Chief local truth before reasoning forward.',
    contextFingerprint: CONTEXT,
    proofCookie: COOKIE,
    evidenceRefs: [`https://github.com/jussray/founder-control-room/commit/${FCR_SHA}`],
    ...overrides,
  };
}

function post(body) {
  return new Request('https://chief-ai.example/api/federated-relay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Chief federated relay', () => {
  it('accepts an exact-head FCR handoff and returns a bound reply with no authority transfer', async () => {
    const response = await handleFederatedRelay(post(envelope()), CHIEF_SHA);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe('accepted');
    expect(body.receipt).toMatchObject({
      messageId: 'q4msg:fcr-to-chief:0001',
      sourceHeadSha: FCR_SHA,
      chiefRuntimeSha: CHIEF_SHA,
      executionAuthorized: false,
      authorityTransferred: false,
      approvalCarriedForward: false,
    });
    expect(body.receipt.messageFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(body.receipt.successorProofCookie).toMatch(/^Q4R:v1:[0-9a-f]{64}$/);
    expect(body.replyEnvelope).toMatchObject({
      replyToMessageId: 'q4msg:fcr-to-chief:0001',
      from: 'chief-ai-machine',
      to: 'founder-control-room',
      sourceRepository: 'jussray/chief-ai-machine',
      sourceHeadSha: CHIEF_SHA,
      targetRepository: 'jussray/founder-control-room',
      targetObservedHeadSha: FCR_SHA,
      contextFingerprint: body.receipt.messageFingerprint,
      proofCookie: body.receipt.successorProofCookie,
    });
  });

  it('fails closed when Chief runtime identity moved', async () => {
    const response = await handleFederatedRelay(post(envelope()), 'e'.repeat(40));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain('runtime head moved');
  });

  it('rejects authority-shaped fields and repository impersonation', async () => {
    const authority = await handleFederatedRelay(post(envelope({ executionAuthorized: true })), CHIEF_SHA);
    expect(authority.status).toBe(400);

    const impersonation = await handleFederatedRelay(post(envelope({ sourceRepository: 'jussray/promptos' })), CHIEF_SHA);
    expect(impersonation.status).toBe(400);
  });
});
