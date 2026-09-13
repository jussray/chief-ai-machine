import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

const baseURL = process.env.PROOFMODE_BASE_URL;
const expectedChiefHead = process.env.EXPECTED_HEAD_SHA;

if (!baseURL) throw new Error('PROOFMODE_BASE_URL is required');
if (!expectedChiefHead) throw new Error('EXPECTED_HEAD_SHA is required');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function currentFcrHead() {
  const response = await fetch('https://api.github.com/repos/jussray/founder-control-room/branches/main', {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'chief-ai-federated-relay-playwright',
    },
  });
  if (!response.ok) throw new Error(`FCR head lookup failed: ${response.status}`);
  const body = await response.json();
  const sha = body?.commit?.sha;
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error('FCR current main did not return an exact commit SHA');
  }
  return sha.toLowerCase();
}

function expectedRelayFingerprint(envelope) {
  return sha256(JSON.stringify({
    contract: envelope.contract,
    messageId: envelope.messageId,
    replyToMessageId: envelope.replyToMessageId ?? null,
    from: envelope.from,
    to: envelope.to,
    sourceRepository: envelope.sourceRepository,
    sourceBranch: envelope.sourceBranch,
    sourceHeadSha: envelope.sourceHeadSha,
    targetRepository: envelope.targetRepository,
    targetBranch: envelope.targetBranch,
    targetObservedHeadSha: envelope.targetObservedHeadSha,
    subject: envelope.subject,
    payload: envelope.payload,
    contextFingerprint: envelope.contextFingerprint,
    proofCookie: envelope.proofCookie,
    evidenceRefs: envelope.evidenceRefs,
  }));
}

test('FCR to Chief returns an exact-head, authority-safe bound reply', async ({ request }) => {
  const fcrHead = await currentFcrHead();
  const contextFingerprint = sha256(`fcr-chief-live:${fcrHead}:${expectedChiefHead}`);
  const proofCookie = `Q4:v1:${sha256(`predecessor:${fcrHead}:${expectedChiefHead}`)}`;
  const envelope = {
    contract: 'juss/federated-agent-relay@v1',
    messageId: `q4msg:playwright:${fcrHead.slice(0, 12)}:${expectedChiefHead.slice(0, 12)}`,
    from: 'founder-control-room',
    to: 'chief-ai-machine',
    sourceRepository: 'jussray/founder-control-room',
    sourceBranch: 'main',
    sourceHeadSha: fcrHead,
    targetRepository: 'jussray/chief-ai-machine',
    targetBranch: 'main',
    targetObservedHeadSha: expectedChiefHead,
    subject: 'Live exact-head federated continuity proof',
    payload: 'Return a bound evidence-only reply. Do not transfer founder approval or execution authority.',
    contextFingerprint,
    proofCookie,
    evidenceRefs: [
      `https://github.com/jussray/founder-control-room/commit/${fcrHead}`,
      `https://github.com/jussray/chief-ai-machine/commit/${expectedChiefHead}`,
      `${baseURL}/version`,
    ],
  };

  const expectedFingerprint = expectedRelayFingerprint(envelope);
  const expectedSuccessorCookie = `Q4R:v1:${sha256(`${proofCookie}:${expectedFingerprint}`)}`;
  const response = await request.post(`${baseURL}/api/federated-relay`, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    data: envelope,
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({
    contract: 'juss/federated-agent-relay@v1',
    status: 'accepted',
    receipt: {
      messageId: envelope.messageId,
      messageFingerprint: expectedFingerprint,
      predecessorProofCookie: proofCookie,
      successorProofCookie: expectedSuccessorCookie,
      sourceHeadSha: fcrHead,
      chiefRuntimeSha: expectedChiefHead,
      executionAuthorized: false,
      authorityTransferred: false,
      approvalCarriedForward: false,
    },
    replyEnvelope: {
      replyToMessageId: envelope.messageId,
      from: 'chief-ai-machine',
      to: 'founder-control-room',
      sourceRepository: 'jussray/chief-ai-machine',
      sourceHeadSha: expectedChiefHead,
      targetRepository: 'jussray/founder-control-room',
      targetObservedHeadSha: fcrHead,
      contextFingerprint: expectedFingerprint,
      proofCookie: expectedSuccessorCookie,
    },
  });
});
