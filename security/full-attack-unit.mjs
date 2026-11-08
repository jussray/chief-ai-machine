export const ATTACK_UNIT_MEMBERS = Object.freeze([
  'attack-10','attack-20','attack-30','attack-3000','attack-5000','attack-6000','attack-48000',
  'redteam-i','redteam-ii','redteam-twin','devil','ultrathink','l99','lindymode','ooda',
  'truthmode','confess','goalfix','proof-mode','fingerprint','continuity','exact-head','rollback',
]);

const AUTHORIZATION_STATES = new Set(['AUTHORIZED', 'UNAUTHORIZED', 'UNKNOWN', 'NOT_EVALUATED']);

function result(flow, status, check, evidence = {}) {
  return Object.freeze({ flow, executed: true, status, check, evidence: Object.freeze({ ...evidence }) });
}

function normalizeAuthorization(observation) {
  const raw = observation?.authorization ?? {};
  const state = AUTHORIZATION_STATES.has(raw.state) ? raw.state : 'UNKNOWN';
  const evidenceRefs = Array.isArray(raw.evidenceRefs)
    ? [...new Set(raw.evidenceRefs.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))].sort()
    : [];
  return Object.freeze({ state, evidenceRefs: Object.freeze(evidenceRefs), derivedFromRuntimeSignals: false });
}

export function runFullAttackUnit(observation) {
  const identity = observation?.technicalIdentity ?? {};
  const hallway = observation?.hallway ?? {};
  const boundaries = observation?.boundaries ?? {};
  const verdict = observation?.verdict ?? 'UNKNOWN';
  const authorization = normalizeAuthorization(observation);

  const suspicious = verdict === 'HALLWAY' || verdict === 'UNKNOWN_AUTOMATION' || verdict === 'CLAIMED_AUTOMATION';
  const surfaceBoundaryBounded = boundaries.ownedSurfaceOnly === true
    && boundaries.externalCompromise === false
    && boundaries.externalExploit === false
    && boundaries.outboundRetaliation === false;
  const hallwayBounded = hallway.productionExposure === 0
    && hallway.realCustomerData === false
    && hallway.realCredentials === false
    && hallway.crossSessionSharing === false;
  const expansionBounded = Number(hallway.logicalExpansion ?? 0) <= 95_999;
  const hasReceipt = typeof observation?.receipt === 'string' && observation.receipt.length >= 32;
  const claimedButUnverified = Boolean(identity.claimedCrawler) && identity.verifiedBot !== true;

  const results = [
    result('attack-10', suspicious ? 'CONTAIN' : 'PASS', 'technical probe classification', { verdict }),
    result('attack-20', observation?.priorReceipt ? 'PASS' : 'NO_PREDECESSOR', 'continuity and replay context', { priorReceipt: Boolean(observation?.priorReceipt) }),
    result('attack-30', surfaceBoundaryBounded ? 'PASS' : 'BLOCK', 'surface and execution containment boundary; authorization is separate', { surfaceBoundaryBounded, authorizationState: authorization.state }),
    result('attack-3000', claimedButUnverified ? 'CHALLENGE' : 'PASS', 'conflicting identity claims', { claimedButUnverified }),
    result('attack-5000', expansionBounded ? 'PASS' : 'BLOCK', 'resource and expansion ceiling', { logicalExpansion: hallway.logicalExpansion ?? 0 }),
    result('attack-6000', hasReceipt ? 'PASS' : 'BLOCK', 'evidence and receipt integrity', { hasReceipt }),
    result('attack-48000', hallwayBounded ? 'PASS' : 'BLOCK', 'production escape and data-leak boundary', { hallwayBounded }),
    result('redteam-i', suspicious ? 'CONTAIN' : 'PASS', 'technical exploit posture', { suspicious }),
    result('redteam-ii', surfaceBoundaryBounded ? 'SEPARATE_AUTHORITY_CHECK' : 'BLOCK', 'control-plane escalation posture; runtime behavior does not establish authorization', { surfaceBoundaryBounded, authorizationState: authorization.state }),
    result('redteam-twin', observation?.counterpartReceipt ? 'PASS' : 'NO_COUNTERPART', 'paired-system trust must be independently proven', { counterpartReceipt: Boolean(observation?.counterpartReceipt) }),
    result('devil', hallway.lazyMaterialization !== false && expansionBounded ? 'PASS' : 'BLOCK', 'premise, recursion, and defender-cost challenge', { lazyMaterialization: hallway.lazyMaterialization !== false }),
    result('l99', surfaceBoundaryBounded && hallwayBounded ? 'PASS' : 'BLOCK', 'evidence, containment, rollback, and separately evidenced authorization', { surfaceBoundaryBounded, hallwayBounded, authorizationState: authorization.state }),
    result('lindymode', hallway.lazyMaterialization !== false ? 'PASS' : 'WARN', 'durability and bounded-complexity screen', { lazyMaterialization: hallway.lazyMaterialization !== false }),
    result('ooda', 'EXECUTED', 'observe-orient-decide-act loop', { action: suspicious ? 'contain-and-observe' : 'observe' }),
    result('truthmode', identity.verifiedBot ? 'VERIFIED' : identity.claimedCrawler ? 'CLAIMED' : 'UNKNOWN', 'epistemic identity state', { verifiedBot: identity.verifiedBot === true }),
    result('confess', claimedButUnverified || !identity.actorFingerprint ? 'UNKNOWN_REMAINS' : 'EVIDENCE_BOUND', 'explicit unknowns and attribution limits', { claimedButUnverified, actorFingerprint: Boolean(identity.actorFingerprint) }),
    result('proof-mode', hasReceipt ? 'PASS' : 'BLOCK', 'event proof receipt exists', { hasReceipt }),
    result('fingerprint', identity.actorFingerprint ? 'PASS' : 'NO_STABLE_ACTOR_FINGERPRINT', 'pseudonymous actor correlation', { actorFingerprint: Boolean(identity.actorFingerprint) }),
    result('continuity', observation?.priorReceipt ? 'PASS' : 'NO_PREDECESSOR', 'predecessor/successor evidence', { priorReceipt: Boolean(observation?.priorReceipt) }),
    result('exact-head', 'NOT_APPLICABLE_RUNTIME', 'git exact-head is enforced at build/merge gate, not inferred from a request'),
    result('rollback', 'PASS', 'hallway action is non-mutating and synthetic', { productionMutation: false }),
  ];

  const blocked = results.filter((item) => item.status === 'BLOCK');
  const repairNeeded = blocked.length > 0;
  results.push(result('goalfix', repairNeeded ? 'REPAIR_REQUIRED' : 'PASS', 'repair membrane', { blockedFlows: blocked.map((item) => item.flow) }));
  results.push(result('ultrathink', repairNeeded ? 'REPAIR_REQUIRED' : 'EXECUTED', 'aggregate all member verdicts before next action', { blockedFlows: blocked.map((item) => item.flow) }));

  const missing = ATTACK_UNIT_MEMBERS.filter((flow) => !results.some((item) => item.flow === flow));
  const unitVerdict = repairNeeded
    ? 'REPAIR_REQUIRED'
    : verdict === 'HALLWAY'
      ? 'CONTAIN_ONLY'
      : verdict === 'VERIFIED_AUTOMATION'
        ? 'SAFE_TO_ALLOW_POLICY'
        : suspicious
          ? 'CHALLENGE_OR_CONTAIN'
          : 'SAFE_TO_OBSERVE';

  return Object.freeze({
    schema: 'juss/full-attack-unit@v1',
    mode: 'executed',
    unitVerdict,
    authorization,
    executedCount: results.length,
    expectedCount: ATTACK_UNIT_MEMBERS.length,
    allMembersAccountedFor: missing.length === 0,
    missingMembers: Object.freeze(missing),
    results: Object.freeze(results),
  });
}
