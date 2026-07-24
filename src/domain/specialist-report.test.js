import { describe, expect, it } from 'vitest';
import {
  assessSpecialistReport,
  createSpecialistReport,
  validateSpecialistReport,
} from './specialist-report.js';

const NOW = new Date('2026-07-24T04:00:00.000Z');

const BASE_INPUT = {
  workspaceId: 'juss',
  projectId: 'chief-ai-machine',
  role: 'Engineering Chief',
  domain: 'Engineering',
  position: 'support',
  conclusion: 'The domain contract is focused and reversible.',
  recommendation: 'Merge after focused verification.',
  reality: [{
    state: 'verified',
    statement: 'The diff changes only domain code, tests, and documentation.',
    sourceRefs: ['git-diff'],
  }],
  confidence: 92,
  risks: ['The contract is not yet wired to a runtime.'],
  status: 'reviewed',
};

describe('specialist reports', () => {
  it('creates a normalized, evidence-backed specialist report', () => {
    const report = createSpecialistReport({
      ...BASE_INPUT,
      assumptions: ['No UI change', 'No UI change'],
    }, NOW);

    expect(report.domain).toBe('engineering');
    expect(report.assumptions).toEqual(['No UI change']);
    expect(report.id).toContain('engineering');
    expect(validateSpecialistReport(report)).toEqual({ valid: true, errors: [] });
    expect(assessSpecialistReport(report)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it.each(['92', '', null, true])('rejects coerced confidence value %j', (confidence) => {
    expect(() => createSpecialistReport({
      ...BASE_INPUT,
      confidence,
    }, NOW)).toThrow('Specialist confidence must be an integer from 0 to 100');
  });

  it('requires a dependency for a conditional position', () => {
    expect(() => createSpecialistReport({
      ...BASE_INPUT,
      position: 'conditional',
      dependencies: [],
    }, NOW)).toThrow('Conditional specialist reports require at least one dependency');
  });

  it('does not validate reviewed reports without verified reality', () => {
    const report = createSpecialistReport({
      ...BASE_INPUT,
      reality: [{ state: 'unknown', statement: 'Hosted verification is unavailable.' }],
    }, NOW);

    expect(validateSpecialistReport(report)).toEqual({
      valid: false,
      errors: ['Reviewed or approved specialist reports require at least one verified reality item'],
    });
  });

  it('warns when specialist confidence outruns evidence and risk accountability', () => {
    const report = createSpecialistReport({
      ...BASE_INPUT,
      status: 'draft',
      reality: [
        { state: 'verified', statement: 'The source compiles.' },
        { state: 'blocked', statement: 'Hosted checks did not execute.' },
      ],
      risks: [],
      confidence: 88,
    }, NOW);

    expect(assessSpecialistReport(report)).toEqual({
      valid: true,
      errors: [],
      warnings: [
        'One or more verified specialist reality items have no source reference',
        'No specialist risk is recorded',
        'High specialist confidence is paired with unknown or blocked reality items',
      ],
    });
  });
});
