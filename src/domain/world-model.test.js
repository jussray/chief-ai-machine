import { describe, expect, it } from 'vitest';
import {
  createLearningDeltaReceipt,
  createWorldPredictionReceipt,
  validateLearningDeltaReceipt,
  validateWorldPredictionReceipt,
} from './world-model.js';

const NOW = new Date('2026-09-23T02:40:00.000Z');

describe('world model receipts', () => {
  it('creates advisory-only predictions before observation', () => {
    const receipt = createWorldPredictionReceipt({
      workspaceId: 'founder',
      projectId: 'facebook-growth',
      experimentId: 'fb-0042',
      hypothesis: 'Proof content will produce stronger qualified attention than generic announcements.',
      predictions: [
        { metric: 'qualified_view_rate', expectation: 'higher_than_baseline', confidence: 0.64 },
        { metric: 'stars', expectation: 'low_to_medium', confidence: 0.4 },
      ],
      evidenceRefs: ['fcr://baseline/facebook'],
    }, NOW);

    expect(validateWorldPredictionReceipt(receipt)).toEqual({ valid: true, errors: [] });
    expect(receipt.authority.permitsExecution).toBe(false);
    expect(receipt.authority.permitsPublishing).toBe(false);
  });

  it('keeps learning advisory and preserves Council dissent', () => {
    const prediction = createWorldPredictionReceipt({
      experimentId: 'fb-0042',
      hypothesis: 'Proof content should beat the current baseline.',
      predictions: [{ metric: 'qualified_view_rate', expectation: 'higher_than_baseline', confidence: 0.64 }],
    }, NOW);

    const delta = createLearningDeltaReceipt({
      prediction,
      observation: { id: 'fcr-world-observation-fb-0042', experimentId: 'fb-0042' },
      metricFindings: [{
        metric: 'qualified_view_rate',
        result: 'confirmed',
        expected: 'higher_than_baseline',
        observed: '1.4x baseline',
        evidenceRefs: ['fcr://observation/fb-0042'],
      }],
      decision: 'retest',
      causality: 'inferred',
      confidenceBefore: 0.64,
      confidenceAfter: 0.71,
      council: {
        synthesisId: 'council-17',
        dissent: ['Timing may explain part of the lift.'],
      },
    }, NOW);

    expect(validateLearningDeltaReceipt(delta)).toEqual({ valid: true, errors: [] });
    expect(delta.council.dissentPreserved).toBe(true);
    expect(delta.decision).toBe('retest');
    expect(delta.authority.permitsAuthorityTransfer).toBe(false);
  });

  it('refuses to learn across mismatched experiments', () => {
    const prediction = createWorldPredictionReceipt({
      experimentId: 'fb-0042',
      hypothesis: 'A bounded hypothesis.',
      predictions: [{ metric: 'watch_time', expectation: 'higher', confidence: 0.5 }],
    }, NOW);

    expect(() => createLearningDeltaReceipt({
      prediction,
      observation: { id: 'obs-2', experimentId: 'fb-9999' },
      metricFindings: [{ metric: 'watch_time', result: 'inconclusive' }],
      decision: 'hold',
    }, NOW)).toThrow('experiment ids must match');
  });
});
