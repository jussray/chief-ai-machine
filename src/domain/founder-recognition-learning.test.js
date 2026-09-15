import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildFounderRecognitionLearningSignal,
  validateFounderRecognitionCompilation,
} from './founder-recognition-learning.js';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function recognition(overrides = {}) {
  const identity = {
    version: 1,
    kind: 'fcr/founder-recognition-compilation',
    chain_id: 'chief-143-proofmode',
    classification: 'VERIFIED',
    highest_outcome_plane: 'TEST',
    recognized_outcome: 'Chief exact-head source tests passed.',
    current_event_hash: 'a'.repeat(64),
    evidence_hashes: ['a'.repeat(64), 'b'.repeat(64)].sort(),
    duplicate_count: 1,
    contradiction_refs: [],
    blocked_planes: ['RUNTIME'],
    superseded_dedup_keys: ['github-chief-old-head'],
    current_as_of: '2026-09-05T04:10:00.000Z',
    ...overrides,
  };

  const value = {
    ...identity,
    recognition_hash: hash(identity),
    authority: {
      recognition_only: true,
      highest_plane_may_not_exceed_evidence: true,
      can_authorize_publish: false,
      can_execute: false,
      can_increase_authority: false,
      contradictions_fail_closed: true,
      duplicate_events_count_once: true,
      historical_truth_immutable: true,
      current_truth_requires_reobservation: true,
    },
  };
  return value;
}

describe('Founder recognition learning signal', () => {
  it('accepts a bounded verified FCR recognition compilation', () => {
    const source = recognition();
    const validated = validateFounderRecognitionCompilation(source);
    expect(validated.classification).toBe('VERIFIED');
    expect(validated.highest_outcome_plane).toBe('TEST');

    const signal = buildFounderRecognitionLearningSignal(source);
    expect(signal.kind).toBe('chief-ai/founder-recognition-learning-signal');
    expect(signal.source_trust).toBe('submitted-unverified');
    expect(signal.source_authentication_verified).toBe(false);
    expect(signal.highest_outcome_plane).toBe('TEST');
    expect(signal.blocked_planes).toEqual(['RUNTIME']);
    expect(signal.authority.learning_authority).toBe('advisory_only');
    expect(signal.authority.may_upgrade_truth).toBe(false);
    expect(signal.authority.execution_authorized).toBe(false);
    expect(signal.authority.publish_authorized).toBe(false);
  });

  it('rejects tampering with the recognition payload', () => {
    const source = recognition();
    expect(() => validateFounderRecognitionCompilation({
      ...source,
      recognized_outcome: 'Inflated claim added after compilation.',
    })).toThrow(/recognition_hash does not match/);
  });

  it('rejects VERIFIED recognition with contradictions', () => {
    const source = recognition({ contradiction_refs: ['github://conflict'] });
    expect(() => validateFounderRecognitionCompilation(source)).toThrow(/VERIFIED recognition may not contain contradictions/);
  });

  it('rejects non-verified recognition that still carries a win claim', () => {
    const source = recognition({
      classification: 'HOLD',
      contradiction_refs: ['dedup:conflict'],
    });
    expect(() => validateFounderRecognitionCompilation(source)).toThrow(/non-VERIFIED recognition may not carry a recognized_outcome/);
  });

  it('accepts a fail-closed HOLD when no outcome is promoted', () => {
    const source = recognition({
      classification: 'HOLD',
      highest_outcome_plane: null,
      recognized_outcome: null,
      current_event_hash: null,
      contradiction_refs: ['dedup:github-chief-143-head'],
    });
    const validated = validateFounderRecognitionCompilation(source);
    expect(validated.classification).toBe('HOLD');
    expect(validated.recognized_outcome).toBeNull();

    const signal = buildFounderRecognitionLearningSignal(source);
    expect(signal.source_classification).toBe('HOLD');
    expect(signal.contradiction_count).toBe(1);
    expect(signal.authority.publish_authorized).toBe(false);
  });

  it('rejects an invalid recognition authority ceiling', () => {
    const source = recognition();
    expect(() => validateFounderRecognitionCompilation({
      ...source,
      authority: {
        ...source.authority,
        can_authorize_publish: true,
      },
    })).toThrow(/recognition authority boundary is invalid/);
  });
});
