import { describe, expect, it } from 'vitest';
import { evaluateTaskAccuracy } from './task-accuracy-v1.js';

describe('response format acceptance', () => {
  it('does not mark content-only success as task completion', () => {
    const result = evaluateTaskAccuracy({
      intent: 'Compare two answers in three to five sentences',
      acceptanceCriteria: [
        { id: 'content', text: 'Correct comparison' },
        { id: 'format', text: 'Three to five sentences' },
      ],
      claimedComplete: true,
    }, [
      { plane: 'outcome', state: 'VERIFIED', ref: 'test:content', claimId: 'content', verdict: 'matched' },
      { plane: 'outcome', state: 'VERIFIED', ref: 'test:format', claimId: 'format', verdict: 'missed' },
    ], { claimState: 'VERIFIED', outcomeVerified: true });
    expect(result.accuracy).toBe('Partial');
    expect(result.completionClaimAllowed).toBe(false);
    expect(result.falseGreen).toBe(true);
  });
});
