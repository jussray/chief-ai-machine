import { createHash } from 'node:crypto';

const SCHEMA = 'ultrathink/v4-advisory-handoff@v0';
const SHA256 = /^[a-f0-9]{64}$/;
const EXACT_FIELDS = ['evidenceLevel', 'learningHash', 'observationHash', 'schema', 'subjectHash'];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function record(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function digest(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`FOUNDER_CONTENT_V4_ADVISORY_REJECTED: ${label} must be sha256`);
  }
  const normalized = value.trim().toLowerCase();
  if (!SHA256.test(normalized)) {
    throw new Error(`FOUNDER_CONTENT_V4_ADVISORY_REJECTED: ${label} must be sha256`);
  }
  return normalized;
}

/**
 * Runtime validation for the cross-repo FCR -> Chief V4 advisory boundary.
 * The handoff is evidence-only and must contain no raw observation payload.
 */
export function validateFounderContentV4AdvisoryHandoff(input) {
  if (!record(input)) {
    throw new Error('FOUNDER_CONTENT_V4_ADVISORY_REJECTED: handoff must be an object');
  }

  const keys = Object.keys(input).sort();
  if (keys.length !== EXACT_FIELDS.length || keys.some((key, index) => key !== EXACT_FIELDS[index])) {
    throw new Error('FOUNDER_CONTENT_V4_ADVISORY_REJECTED: handoff contains non-advisory fields');
  }
  if (input.schema !== SCHEMA) {
    throw new Error('FOUNDER_CONTENT_V4_ADVISORY_REJECTED: schema mismatch');
  }
  if (input.evidenceLevel !== 'ATTESTED') {
    throw new Error('FOUNDER_CONTENT_V4_ADVISORY_REJECTED: evidence level exceeds ATTESTED ceiling');
  }

  const subjectHash = digest(input.subjectHash, 'subjectHash');
  const observationHash = digest(input.observationHash, 'observationHash');
  const learningHash = digest(input.learningHash, 'learningHash');
  const expected = sha256(`${SCHEMA}\n${subjectHash}\n${observationHash}\nATTESTED`);
  if (learningHash !== expected) {
    throw new Error('FOUNDER_CONTENT_V4_ADVISORY_REJECTED: learning hash integrity failure');
  }

  return Object.freeze({ learningHash });
}

/**
 * Feed only the validated learning hash into Chief strategy memory.
 * The raw handoff itself is intentionally not retained in strategy state.
 */
export function attachV4AdvisoryLearningToStrategyInput(strategyInput = {}, handoff) {
  if (!record(strategyInput)) {
    throw new Error('FOUNDER_CONTENT_V4_ADVISORY_REJECTED: strategy input must be an object');
  }
  const { learningHash } = validateFounderContentV4AdvisoryHandoff(handoff);
  const ownHistory = record(strategyInput.own_history) ? strategyInput.own_history : {};
  const existing = ownHistory.learning_signal_hashes;
  if (existing !== undefined && !Array.isArray(existing)) {
    throw new Error('FOUNDER_CONTENT_V4_ADVISORY_REJECTED: own_history.learning_signal_hashes must be an array');
  }

  return {
    ...strategyInput,
    own_history: {
      ...ownHistory,
      learning_signal_hashes: [...new Set([...(existing ?? []), learningHash])],
    },
  };
}
