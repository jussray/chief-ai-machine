import { describe, expect, it } from 'vitest';
import {
  assessCapabilityOutcome,
  validateCapabilityOutcomeObservation,
} from './capability-outcome.js';

const BASE = {
  contract: 'juss-v10/outcome-observation@v1',
  capabilityPlanHash: 'a'.repeat(64),
  executionReceiptId: `fcr-conveyor-receipt-v3:${'b'.repeat(64)}`,
  verified: true,
  goalSucceeded: true,
  founderOverride: false,
  rollbackUsed: false,
  evidenceCompleteness: 100,
  outcomeSignals: ['verification-pass'],
  evidenceUrls: ['https://github.com/jussray/founder-control-room/actions/runs/1'],
};

describe('V10 capability outcome learning', () => {
  it('can recommend a promotion candidate but never self-promotes', () => {
    const result = assessCapabilityOutcome(BASE);
    expect(result.valid).toBe(true);
    expect(result.recommendation).toBe('candidate-promote');
    expect(result.promotionAllowed).toBe(false);
    expect(result.founderReviewRequired).toBe(true);
  });

  it('routes founder overrides and rollbacks to review', () => {
    expect(assessCapabilityOutcome({ ...BASE, founderOverride: true }).recommendation).toBe('review');
    expect(assessCapabilityOutcome({ ...BASE, rollbackUsed: true }).recommendation).toBe('review');
  });

  it('does not confuse workflow execution with goal success', () => {
    const result = assessCapabilityOutcome({ ...BASE, goalSucceeded: false });
    expect(result.recommendation).toBe('review');
    expect(result.reasons.join(' ')).toContain('founder goal did not succeed');
  });

  it('rejects success claims without verified evidence', () => {
    expect(validateCapabilityOutcomeObservation({
      ...BASE,
      verified: false,
      evidenceUrls: [],
    }).errors).toContain('Goal success cannot be interpreted before verification');
  });
});
