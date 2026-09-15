import { createHash } from 'node:crypto';

export const FCR_FOUNDER_RECOGNITION_KIND = 'fcr/founder-recognition-compilation';
export const CHIEF_FOUNDER_RECOGNITION_LEARNING_KIND = 'chief-ai/founder-recognition-learning-signal';

const HASH = /^[0-9a-f]{64}$/i;
const IDENTIFIER = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CLASSIFICATIONS = new Set(['VERIFIED', 'OBSERVED', 'INFERRED', 'HOLD', 'BLOCKED', 'NO_MATERIAL_OUTCOME']);
const OUTCOME_PLANES = new Set([
  'INTENT',
  'EXECUTION_SOURCE',
  'TEST',
  'PROVIDER',
  'RUNTIME',
  'BROWSER',
  'EXTERNAL_CONSEQUENCE',
  'COVERAGE_UNKNOWN',
]);

function text(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fail(errors) {
  throw Object.assign(new Error(`FOUNDER_RECOGNITION_LEARNING_REJECTED: ${errors.join('; ')}`), {
    code: 'FOUNDER_RECOGNITION_LEARNING_REJECTED',
    details: errors,
  });
}

function stringList(value, max = 1000) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => text(item, max)).filter(Boolean))].sort()
    : [];
}

function canonicalRecognition(input = {}) {
  return {
    version: 1,
    kind: FCR_FOUNDER_RECOGNITION_KIND,
    chain_id: text(input.chain_id, 160).toLowerCase(),
    classification: text(input.classification, 40).toUpperCase(),
    highest_outcome_plane: text(input.highest_outcome_plane, 40).toUpperCase() || null,
    recognized_outcome: text(input.recognized_outcome, 600) || null,
    current_event_hash: text(input.current_event_hash, 64).toLowerCase() || null,
    evidence_hashes: stringList(input.evidence_hashes, 64).map((value) => value.toLowerCase()),
    duplicate_count: input.duplicate_count,
    contradiction_refs: stringList(input.contradiction_refs, 1200),
    blocked_planes: stringList(input.blocked_planes, 40).map((value) => value.toUpperCase()),
    superseded_dedup_keys: stringList(input.superseded_dedup_keys, 160).map((value) => value.toLowerCase()),
    current_as_of: text(input.current_as_of, 64) || null,
  };
}

export function validateFounderRecognitionCompilation(input) {
  if (!isRecord(input)) fail(['recognition must be an object']);
  const errors = [];
  const identity = canonicalRecognition(input);
  const recognitionHash = text(input.recognition_hash, 64).toLowerCase();

  if (input.version !== 1) errors.push('version must be 1');
  if (input.kind !== FCR_FOUNDER_RECOGNITION_KIND) errors.push('unsupported recognition kind');
  if (!IDENTIFIER.test(identity.chain_id)) errors.push('chain_id is invalid');
  if (!CLASSIFICATIONS.has(identity.classification)) errors.push('classification is invalid');
  if (identity.highest_outcome_plane && !OUTCOME_PLANES.has(identity.highest_outcome_plane)) {
    errors.push('highest_outcome_plane is invalid');
  }
  if (!Number.isInteger(identity.duplicate_count) || identity.duplicate_count < 0) {
    errors.push('duplicate_count must be a non-negative integer');
  }
  if (identity.current_as_of && (!ISO_DATE.test(identity.current_as_of) || Number.isNaN(Date.parse(identity.current_as_of)))) {
    errors.push('current_as_of must be ISO UTC or null');
  }
  if (identity.evidence_hashes.some((value) => !HASH.test(value))) errors.push('evidence_hashes must contain SHA-256 values');
  if (identity.current_event_hash && !HASH.test(identity.current_event_hash)) errors.push('current_event_hash must be SHA-256 or null');
  if (identity.blocked_planes.some((value) => !OUTCOME_PLANES.has(value))) errors.push('blocked_planes contains an invalid plane');

  if (identity.classification === 'VERIFIED') {
    if (!identity.highest_outcome_plane || identity.highest_outcome_plane === 'COVERAGE_UNKNOWN') {
      errors.push('VERIFIED recognition requires a concrete highest_outcome_plane');
    }
    if (!identity.recognized_outcome) errors.push('VERIFIED recognition requires recognized_outcome');
    if (!identity.current_event_hash) errors.push('VERIFIED recognition requires current_event_hash');
    if (identity.evidence_hashes.length === 0) errors.push('VERIFIED recognition requires evidence_hashes');
    if (identity.contradiction_refs.length > 0) errors.push('VERIFIED recognition may not contain contradictions');
  } else {
    if (identity.recognized_outcome !== null) errors.push('non-VERIFIED recognition may not carry a recognized_outcome');
    if (identity.highest_outcome_plane !== null) errors.push('non-VERIFIED recognition may not claim a highest_outcome_plane');
    if (identity.current_event_hash !== null) errors.push('non-VERIFIED recognition may not claim a current_event_hash');
  }

  const authority = isRecord(input.authority) ? input.authority : null;
  if (!authority
      || authority.recognition_only !== true
      || authority.highest_plane_may_not_exceed_evidence !== true
      || authority.can_authorize_publish !== false
      || authority.can_execute !== false
      || authority.can_increase_authority !== false
      || authority.contradictions_fail_closed !== true
      || authority.duplicate_events_count_once !== true
      || authority.historical_truth_immutable !== true
      || authority.current_truth_requires_reobservation !== true) {
    errors.push('recognition authority boundary is invalid');
  }

  if (!HASH.test(recognitionHash)) errors.push('recognition_hash must be SHA-256');
  else if (hash(identity) !== recognitionHash) errors.push('recognition_hash does not match canonical recognition identity');

  if (errors.length > 0) fail(errors);
  return Object.freeze({ ...identity, recognition_hash: recognitionHash });
}

export function buildFounderRecognitionLearningSignal(input) {
  const recognition = validateFounderRecognitionCompilation(input);
  const signalIdentity = {
    version: 1,
    kind: CHIEF_FOUNDER_RECOGNITION_LEARNING_KIND,
    declared_source_system: 'founder-control-room',
    source_trust: 'submitted-unverified',
    source_authentication_verified: false,
    source_kind: FCR_FOUNDER_RECOGNITION_KIND,
    source_recognition_hash: recognition.recognition_hash,
    chain_id: recognition.chain_id,
    source_classification: recognition.classification,
    highest_outcome_plane: recognition.highest_outcome_plane,
    recognized_outcome: recognition.recognized_outcome,
    source_current_event_hash: recognition.current_event_hash,
    source_current_as_of: recognition.current_as_of,
    evidence_digest: hash(recognition.evidence_hashes),
    evidence_count: recognition.evidence_hashes.length,
    duplicate_count: recognition.duplicate_count,
    contradiction_count: recognition.contradiction_refs.length,
    blocked_planes: recognition.blocked_planes,
    superseded_count: recognition.superseded_dedup_keys.length,
  };

  return Object.freeze({
    ...signalIdentity,
    learning_hash: hash(signalIdentity),
    authority: Object.freeze({
      evidence_only: true,
      learning_authority: 'advisory_only',
      may_upgrade_truth: false,
      execution_authorized: false,
      publish_authorized: false,
      content_mutation_authorized: false,
      may_increase_authority: false,
      authenticated_source_required_for_canonical_learning: true,
      founder_approval_required_for_external_action: true,
    }),
  });
}
