const CONTRACT = 'juss/federated-agent-relay@v1';
const MEMBERS = new Set([
  'founder-control-room',
  'chief-ai-machine',
  'solcontinuity',
  'promptos',
]);
const REPOSITORIES = Object.freeze({
  'founder-control-room': 'jussray/founder-control-room',
  'chief-ai-machine': 'jussray/chief-ai-machine',
  solcontinuity: 'jussray/solcontinuity',
  promptos: 'jussray/promptos',
});
const SHA40 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const COOKIE = /^[A-Za-z0-9:_-]{8,300}$/;
const MESSAGE_ID = /^[A-Za-z0-9:._-]{8,200}$/;
const ALLOWED_FIELDS = new Set([
  'contract',
  'messageId',
  'replyToMessageId',
  'from',
  'to',
  'sourceRepository',
  'sourceBranch',
  'sourceHeadSha',
  'targetRepository',
  'targetBranch',
  'targetObservedHeadSha',
  'subject',
  'payload',
  'contextFingerprint',
  'proofCookie',
  'evidenceRefs',
]);

function boundedString(value, maximum) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function httpsRefs(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const refs = [];
  for (const item of value) {
    const candidate = boundedString(item, 2000);
    if (!candidate) return null;
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    if (!refs.includes(parsed.href)) refs.push(parsed.href);
  }
  return refs;
}

function parseEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Relay envelope must be an object.' };
  }
  if (Object.keys(value).some((key) => !ALLOWED_FIELDS.has(key))) {
    return { ok: false, error: 'Relay envelope contains unsupported fields.' };
  }
  if (value.contract !== CONTRACT) return { ok: false, error: 'Relay contract is missing or unsupported.' };
  if (!MEMBERS.has(value.from) || !MEMBERS.has(value.to) || value.from === value.to) {
    return { ok: false, error: 'Relay requires two different members of the federated quartet.' };
  }

  const messageId = boundedString(value.messageId, 200);
  const replyToMessageId = value.replyToMessageId === undefined
    ? undefined
    : boundedString(value.replyToMessageId, 200);
  const sourceRepository = boundedString(value.sourceRepository, 300);
  const sourceBranch = boundedString(value.sourceBranch, 120);
  const sourceHeadSha = boundedString(value.sourceHeadSha, 40)?.toLowerCase() ?? null;
  const targetRepository = boundedString(value.targetRepository, 300);
  const targetBranch = boundedString(value.targetBranch, 120);
  const targetObservedHeadSha = boundedString(value.targetObservedHeadSha, 40)?.toLowerCase() ?? null;
  const subject = boundedString(value.subject, 500);
  const payload = boundedString(value.payload, 12000);
  const contextFingerprint = boundedString(value.contextFingerprint, 64)?.toLowerCase() ?? null;
  const proofCookie = boundedString(value.proofCookie, 300);
  const evidenceRefs = httpsRefs(value.evidenceRefs);

  if (
    !messageId || !MESSAGE_ID.test(messageId)
    || (replyToMessageId !== undefined && (!replyToMessageId || !MESSAGE_ID.test(replyToMessageId)))
    || !sourceRepository || sourceRepository !== REPOSITORIES[value.from]
    || !sourceBranch
    || !sourceHeadSha || !SHA40.test(sourceHeadSha)
    || !targetRepository || targetRepository !== REPOSITORIES[value.to]
    || !targetBranch
    || !targetObservedHeadSha || !SHA40.test(targetObservedHeadSha)
    || !subject || !payload
    || !contextFingerprint || !SHA256.test(contextFingerprint)
    || !proofCookie || !COOKIE.test(proofCookie)
    || !evidenceRefs
  ) return { ok: false, error: 'Relay envelope is malformed or repository identity drifted.' };

  return {
    ok: true,
    envelope: {
      contract: CONTRACT,
      messageId,
      ...(replyToMessageId ? { replyToMessageId } : {}),
      from: value.from,
      to: value.to,
      sourceRepository,
      sourceBranch,
      sourceHeadSha,
      targetRepository,
      targetBranch,
      targetObservedHeadSha,
      subject,
      payload,
      contextFingerprint,
      proofCookie,
      evidenceRefs,
    },
  };
}

async function sha256(text) {
  const bytes = new globalThis.TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function acceptEnvelope(envelope) {
  const messageFingerprint = await sha256(JSON.stringify({
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
  const successorProofCookie = `Q4R:v1:${await sha256(`${envelope.proofCookie}:${messageFingerprint}`)}`;
  return { messageFingerprint, successorProofCookie };
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function handleFederatedRelay(request, runtimeSha) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > 32768) {
    return json({ error: 'Relay envelope exceeds 32KB.' }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Relay envelope must be valid JSON.' }, 400);
  }

  const parsed = parseEnvelope(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const envelope = parsed.envelope;
  const normalizedRuntimeSha = boundedString(runtimeSha, 40)?.toLowerCase() ?? null;

  if (envelope.to !== 'chief-ai-machine') {
    return json({ error: 'This endpoint accepts only relay messages addressed to chief-ai-machine.' }, 409);
  }
  if (!normalizedRuntimeSha || !SHA40.test(normalizedRuntimeSha)) {
    return json({ error: 'Chief runtime exact-head identity is unavailable.' }, 503);
  }
  if (envelope.targetObservedHeadSha !== normalizedRuntimeSha) {
    return json({
      error: 'Chief runtime head moved; sender must reacquire target evidence.',
      observedRuntimeSha: normalizedRuntimeSha,
    }, 409);
  }

  const accepted = await acceptEnvelope(envelope);
  const replyIdSeed = await sha256(`${envelope.messageId}:${normalizedRuntimeSha}:${accepted.messageFingerprint}`);
  const replyEnvelope = {
    contract: CONTRACT,
    messageId: `q4reply:${replyIdSeed.slice(0, 32)}`,
    replyToMessageId: envelope.messageId,
    from: 'chief-ai-machine',
    to: envelope.from,
    sourceRepository: REPOSITORIES['chief-ai-machine'],
    sourceBranch: 'main',
    sourceHeadSha: normalizedRuntimeSha,
    targetRepository: envelope.sourceRepository,
    targetBranch: envelope.sourceBranch,
    targetObservedHeadSha: envelope.sourceHeadSha,
    subject: `Chief receipt: ${envelope.subject}`.slice(0, 500),
    payload: 'Chief accepted this continuity handoff as evidence-only context, verified the message target against its exact runtime SHA, and returned a bound reply. No founder approval or execution authority transferred.',
    contextFingerprint: accepted.messageFingerprint,
    proofCookie: accepted.successorProofCookie,
    evidenceRefs: [
      ...envelope.evidenceRefs,
      'https://chief-ai.mcgill-raylene.workers.dev/version',
    ].filter((value, index, list) => list.indexOf(value) === index).slice(0, 20),
  };

  return json({
    contract: CONTRACT,
    status: 'accepted',
    receipt: {
      messageId: envelope.messageId,
      messageFingerprint: accepted.messageFingerprint,
      predecessorProofCookie: envelope.proofCookie,
      successorProofCookie: accepted.successorProofCookie,
      sourceHeadSha: envelope.sourceHeadSha,
      chiefRuntimeSha: normalizedRuntimeSha,
      executionAuthorized: false,
      authorityTransferred: false,
      approvalCarriedForward: false,
    },
    replyEnvelope,
  });
}
