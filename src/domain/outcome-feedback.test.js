import { describe, expect, it } from 'vitest';
import { applyCapabilityOutcomeFeedback } from './outcome-feedback.js';

const VERIFIED_SUCCESS = {
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

describe('V10 outcome feedback routing', () => {
  it('preserves the caller request after strong submitted success but never raises it', () => {
    const feedback = applyCapabilityOutcomeFeedback('draft', VERIFIED_SUCCESS);
    expect(feedback.observed).toBe(true);
    expect(feedback.sourceTrust).toBe('submitted-unverified');
    expect(feedback.recommendation).toBe('candidate-promote');
    expect(feedback.requestedAuthority).toBe('draft');
    expect(feedback.effectiveAuthority).toBe('draft');
    expect(feedback.promotionAllowed).toBe(false);
    expect(feedback.founderReviewRequired).toBe(true);
  });

  it('reduces the next plan to reasoning-only after a submitted goal failure', () => {
    const feedback = applyCapabilityOutcomeFeedback('reversible', {
      ...VERIFIED_SUCCESS,
      goalSucceeded: false,
    });
    expect(feedback.recommendation).toBe('review');
    expect(feedback.effectiveAuthority).toBe('reason');
  });

  it('reduces the next plan to reasoning-only after rollback or founder override', () => {
    expect(applyCapabilityOutcomeFeedback('reversible', {
      ...VERIFIED_SUCCESS,
      rollbackUsed: true,
    }).effectiveAuthority).toBe('reason');

    expect(applyCapabilityOutcomeFeedback('reversible', {
      ...VERIFIED_SUCCESS,
      founderOverride: true,
    }).effectiveAuthority).toBe('reason');
  });

  it('fails closed on invalid or unverified feedback', () => {
    const feedback = applyCapabilityOutcomeFeedback('privileged', {
      ...VERIFIED_SUCCESS,
      verified: false,
      goalSucceeded: null,
      evidenceUrls: [],
    });
    expect(feedback.sourceTrust).toBe('submitted-unverified');
    expect(feedback.recommendation).toBe('hold');
    expect(feedback.effectiveAuthority).toBe('reason');
    expect(feedback.promotionAllowed).toBe(false);
  });

  it('leaves the existing requested authority unchanged when no feedback exists', () => {
    const feedback = applyCapabilityOutcomeFeedback('reversible');
    expect(feedback.observed).toBe(false);
    expect(feedback.sourceTrust).toBe('none');
    expect(feedback.effectiveAuthority).toBe('reversible');
  });
});
