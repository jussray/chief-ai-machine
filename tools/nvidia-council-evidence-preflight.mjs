// Advisory-only structural preflight for REAL specialist review submissions.
// This module does not manufacture reports, authenticate reviewers, verify
// cited evidence, invoke vendor APIs, or synthesize native Council outcomes.
import { prepareNvidiaCouncilReview } from './nvidia-council-review.mjs';

const POSITIONS = Object.freeze(['support', 'conditional', 'oppose', 'abstain']);
const STATUSES = Object.freeze(['reviewed', 'approved']);
const REALITY_STATES = Object.freeze(['verified', 'inferred', 'unknown', 'blocked']);
const REQUIRED_DOMAINS = Object.freeze([
  'engineering', 'security', 'privacy', 'product-safety', 'operations',
]);

// Never access untrusted input using ordinary property reads: own data only.
function ownData(value, key) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  } catch { return undefined; }
}

function boundedText(value, limit = 2000) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
}

const STATIC_HOLD = Object.freeze({
  schema: 'juss/nvidia-council-evidence-preflight@v1',
  disposition: 'HOLD',
  executionAuthority: 'none',
  mayApprove: false,
  maySendPrivateData: false,
  providerEnabled: false,
  nativeCouncilExecuted: false,
  verifiedSourceEvidence: false,
});

// Locked authority fields win over `extra` by construction (v6 hardening).
const LOCKED = Object.freeze([
  'schema', 'disposition', 'executionAuthority', 'mayApprove',
  'maySendPrivateData', 'providerEnabled', 'nativeCouncilExecuted',
  'verifiedSourceEvidence',
]);
function result(state, reasons, extra = {}) {
  const rest = { ...extra };
  for (const key of LOCKED) delete rest[key];
  return Object.freeze({
    ...STATIC_HOLD,
    state,
    reasons: Object.freeze([...new Set(reasons)]),
    ...rest,
  });
}

/**
 * Preflight only; do not call this function an independent review or approval.
 * Real reports must later pass validateSpecialistReport and the Chief AI
 * synthesizeExecutiveCouncil + brief validators inside the authorized repo.
 */
function preflightNvidiaCouncilEvidenceUnchecked(input) {
  const repository = ownData(input, 'repository');
  const objective = ownData(input, 'objective');
  const plan = prepareNvidiaCouncilReview({ repository, objective });
  if (plan.status !== 'ADVISORY_ONLY') {
    return result('NO_MATCH', ['No allowlisted repository/objective selected']);
  }

  const reports = ownData(input, 'reports');
  if (reports === undefined) {
    return result('INCOMPLETE', ['No independently submitted specialist reports'], {
      requiredDomains: REQUIRED_DOMAINS,
      receivedDomains: Object.freeze([]),
    });
  }
  if (!Array.isArray(reports) || reports.length > REQUIRED_DOMAINS.length) {
    return result('REJECTED', ['Reports must be an array containing at most five records']);
  }
  const reasons = [];
  const seenDomains = new Set();
  const seenIds = new Set();
  const scope = new Set();
  const expectedProject = repository.split('/')[1];

  for (let i = 0; i < reports.length; i += 1) {
    const item = reports[i];
    const prefix = `Report ${i + 1}`;
    const domain = ownData(item, 'domain');
    const id = ownData(item, 'id');
    const workspaceId = ownData(item, 'workspaceId');
    const projectId = ownData(item, 'projectId');
    const position = ownData(item, 'position');
    const status = ownData(item, 'status');
    const reality = ownData(item, 'reality');

    if (!REQUIRED_DOMAINS.includes(domain)) reasons.push(`${prefix}: unknown specialist domain`);
    else if (seenDomains.has(domain)) reasons.push(`${prefix}: duplicate specialist domain`);
    else seenDomains.add(domain);

    if (!boundedText(id, 180) || seenIds.has(id)) reasons.push(`${prefix}: missing or duplicate report ID`);
    else seenIds.add(id);
    if (!boundedText(workspaceId, 120)) reasons.push(`${prefix}: invalid workspace`);
    else scope.add(workspaceId);
    if (projectId !== expectedProject) reasons.push(`${prefix}: report targets wrong project`);
    if (!POSITIONS.includes(position)) reasons.push(`${prefix}: missing or unsupported position`);
    if (!STATUSES.includes(status)) reasons.push(`${prefix}: unreviewed or superseded report`);
    if (!boundedText(ownData(item, 'role'), 120)) reasons.push(`${prefix}: missing reviewer role`);
    if (!boundedText(ownData(item, 'conclusion'), 3000)) reasons.push(`${prefix}: missing conclusion`);
    if (!boundedText(ownData(item, 'recommendation'), 3000)) reasons.push(`${prefix}: missing recommendation`);
    const confidence = ownData(item, 'confidence');
    if (!Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
      reasons.push(`${prefix}: malformed reported confidence`);
    }
    if (position === 'conditional') {
      const dependencies = ownData(item, 'dependencies');
      if (!Array.isArray(dependencies) || !dependencies.some(x => boundedText(x, 2000))) {
        reasons.push(`${prefix}: conditional position missing dependency`);
      }
    }
    if (!Array.isArray(reality) || reality.length === 0 || reality.length > 50) {
      reasons.push(`${prefix}: reality evidence must have 1–50 items`);
      continue;
    }
    let verifiedWithRef = false;
    for (const item of reality) {
      const state = ownData(item, 'state');
      const statement = ownData(item, 'statement');
      const refs = ownData(item, 'sourceRefs');
      if (!REALITY_STATES.includes(state) || !boundedText(statement, 2000)) {
        reasons.push(`${prefix}: invalid reality statement or state`);
      }
      if (!Array.isArray(refs) || refs.length > 20 || refs.some(ref => !boundedText(ref, 500))) {
        reasons.push(`${prefix}: invalid source reference list`);
      } else if (state === 'verified' && refs.length > 0) {
        verifiedWithRef = true;
      }
    }
    if (!verifiedWithRef) reasons.push(`${prefix}: no cited verified reality item`);
  }
  if (scope.size > 1) reasons.push('Reports mix workspaces');
  if (reasons.length > 0) {
    return result('REJECTED', reasons, { receivedDomains: Object.freeze([...seenDomains]) });
  }
  const missing = REQUIRED_DOMAINS.filter(d => !seenDomains.has(d));
  if (missing.length > 0) {
    return result('INCOMPLETE', ['Awaiting reports from: ' + missing.join(', ')], {
      requiredDomains: REQUIRED_DOMAINS,
      receivedDomains: Object.freeze([...seenDomains]),
    });
  }
  return result('READY_FOR_NATIVE_VALIDATION', [
    'Structure only: cited sources and reviewer identities are not independently verified',
    'Call native Chief AI SpecialistReport, Council, and Executive Brief validators on the exact candidate head',
    'Founder Control Room must separately authorize any follow-on action',
  ], { receivedDomains: Object.freeze([...seenDomains]) });
}

// Do not allow Proxy traps, revoked proxies, or attacker-defined array access
// to turn a review preflight into an unhandled exception or authority change.
export function preflightNvidiaCouncilEvidence(input) {
  try { return preflightNvidiaCouncilEvidenceUnchecked(input); }
  catch { return result('REJECTED', ['Unable to safely inspect submitted report structure']); }
}
