import { describe, expect, it } from 'vitest';
import { evaluateTrackedTaskDecision } from './task-accuracy-v1.js';

const fingerprint = 'f7ed2e6122c44b137cdf6686e692515c324ff925';

function criterion(id, text = id) {
  return { id, text };
}

function outcome(claimId, verdict, state = 'VERIFIED', ref = `https://example.com/${claimId}`) {
  return { plane: 'outcome', state, ref, claimId, verdict };
}

function baseInput(overrides = {}) {
  return {
    subjectFingerprint: fingerprint,
    evidence: [],
    taskAccuracy: {
      intent: 'Deliver the founder-requested outcome with proof.',
      acceptanceCriteria: [criterion('runtime'), criterion('outcome')],
      claimedComplete: false,
    },
    ...overrides,
  };
}

describe('Task Accuracy v1', () => {
  it('flags execution-only completion claims as false green', () => {
    const result = evaluateTrackedTaskDecision(baseInput({
      evidence: [{ plane: 'execution', state: 'VERIFIED', ref: 'https://example.com/run' }],
      taskAccuracy: {
        ...baseInput().taskAccuracy,
        claimedComplete: true,
      },
    }));

    expect(result.claimState).toBe('OBSERVED');
    expect(result.taskAccuracy.accuracy).toBe('Unverified');
    expect(result.taskAccuracy.completionClaimAllowed).toBe(false);
    expect(result.taskAccuracy.falseGreen).toBe(true);
  });

  it('marks a task Matched only when every acceptance claim has verified linked outcome evidence', () => {
    const result = evaluateTrackedTaskDecision(baseInput({
      evidence: [
        outcome('runtime', 'matched'),
        outcome('outcome', 'matched'),
      ],
      signals: { primary: 'improved' },
      taskAccuracy: {
        ...baseInput().taskAccuracy,
        claimedComplete: true,
      },
    }));

    expect(result.outcomeVerified).toBe(true);
    expect(result.taskAccuracy.accuracy).toBe('Matched');
    expect(result.taskAccuracy.completionClaimAllowed).toBe(true);
    expect(result.taskAccuracy.falseGreen).toBe(false);
  });

  it('marks mixed verified acceptance evidence Partial', () => {
    const result = evaluateTrackedTaskDecision(baseInput({
      evidence: [outcome('runtime', 'matched')],
    }));

    expect(result.taskAccuracy.accuracy).toBe('Partial');
    expect(result.taskAccuracy.matchedCount).toBe(1);
    expect(result.taskAccuracy.unverifiedCount).toBe(1);
  });

  it('marks a fully disproven task Missed', () => {
    const result = evaluateTrackedTaskDecision(baseInput({
      evidence: [
        outcome('runtime', 'missed'),
        outcome('outcome', 'missed'),
      ],
    }));

    expect(result.taskAccuracy.accuracy).toBe('Missed');
    expect(result.taskAccuracy.missedCount).toBe(2);
    expect(result.taskAccuracy.completionClaimAllowed).toBe(false);
  });

  it('invalidates otherwise matched task proof when the subject fingerprint moves', () => {
    const result = evaluateTrackedTaskDecision(baseInput({
      expectedFingerprint: 'old-head',
      evidence: [
        outcome('runtime', 'matched'),
        outcome('outcome', 'matched'),
      ],
      taskAccuracy: {
        ...baseInput().taskAccuracy,
        claimedComplete: true,
      },
    }));

    expect(result.subjectChanged).toBe(true);
    expect(result.taskAccuracy.proofInvalidated).toBe(true);
    expect(result.taskAccuracy.accuracy).toBe('Unverified');
    expect(result.taskAccuracy.falseGreen).toBe(true);
  });

  it('refuses green when verified outcome evidence conflicts on the same acceptance claim', () => {
    const result = evaluateTrackedTaskDecision(baseInput({
      evidence: [
        outcome('runtime', 'matched'),
        outcome('runtime', 'missed', 'VERIFIED', 'https://example.com/runtime-conflict'),
        outcome('outcome', 'matched'),
      ],
    }));

    expect(result.taskAccuracy.valid).toBe(false);
    expect(result.taskAccuracy.errors).toContain('conflicting verified outcome evidence for acceptance criterion: runtime');
    expect(result.taskAccuracy.accuracy).toBe('Unverified');
  });

  it('does not count unverified outcome evidence as acceptance proof', () => {
    const result = evaluateTrackedTaskDecision(baseInput({
      evidence: [
        outcome('runtime', 'matched', 'OBSERVED'),
        outcome('outcome', 'matched', 'OBSERVED'),
      ],
    }));

    expect(result.taskAccuracy.accuracy).toBe('Unverified');
    expect(result.taskAccuracy.matchedCount).toBe(0);
    expect(result.taskAccuracy.unverifiedCount).toBe(2);
  });
});
