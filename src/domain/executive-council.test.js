import { describe, expect, it } from 'vitest';
import { validateExecutiveBrief } from './executive-brief.js';
import { synthesizeExecutiveCouncil } from './executive-council.js';
import { createSpecialistReport } from './specialist-report.js';

const NOW = new Date('2026-07-24T04:00:00.000Z');

function report(overrides = {}, offset = 0) {
  return createSpecialistReport({
    id: `report-${offset}`,
    workspaceId: 'juss',
    projectId: 'chief-ai-machine',
    role: 'Engineering Chief',
    domain: 'engineering',
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
    ...overrides,
  }, new Date(NOW.getTime() + offset));
}

describe('executive council synthesis', () => {
  it('creates one executive brief while preserving evidence, dissent, and conservative confidence', () => {
    const engineering = report();
    const operations = report({
      id: 'report-operations',
      role: 'Operations Chief',
      domain: 'operations',
      position: 'conditional',
      conclusion: 'The contract is safe, but hosted execution evidence is unavailable.',
      recommendation: 'Proceed only as a domain slice.',
      reality: [
        {
          state: 'verified',
          statement: 'The diff changes only domain code, tests, and documentation.',
          sourceRefs: ['git-diff'],
        },
        {
          state: 'blocked',
          statement: 'GitHub-hosted verification did not execute.',
          sourceRefs: ['workflow-run'],
        },
      ],
      dependencies: ['Keep runtime integration in a separate PR.'],
      confidence: 84,
    }, 1);

    const synthesis = synthesizeExecutiveCouncil({
      decision: 'Merge the specialist and council contracts.',
      reports: [engineering, operations],
      nextGate: 'Founder reviews the next runtime slice.',
      status: 'reviewed',
    }, NOW);

    expect(synthesis.confidence).toMatchObject({
      base: 88,
      lowestSpecialist: 84,
      final: 69,
    });
    expect(synthesis.positions.conditional).toEqual(['Operations Chief']);
    expect(synthesis.brief.dissent).toHaveLength(1);
    expect(synthesis.brief.reality[0].sourceRefs).toEqual(expect.arrayContaining([
      'specialist-report:report-0',
      'specialist-report:report-operations',
    ]));
    expect(validateExecutiveBrief(synthesis.brief)).toEqual({ valid: true, errors: [] });
  });

  it('rejects duplicate domains and duplicate report ids', () => {
    const engineering = report();

    expect(() => synthesizeExecutiveCouncil({
      decision: 'Merge.',
      reports: [engineering, report({ id: 'report-engineering-2', role: 'Another Engineer' }, 2)],
      nextGate: 'Review.',
    }, NOW)).toThrow('Executive Council accepts only one report per domain');

    expect(() => synthesizeExecutiveCouncil({
      decision: 'Merge.',
      reports: [engineering, report({
        id: engineering.id,
        role: 'Operations Chief',
        domain: 'operations',
      }, 3)],
      nextGate: 'Review.',
    }, NOW)).toThrow('Executive Council cannot count the same specialist report more than once');
  });

  it('prevents cross-workspace synthesis', () => {
    expect(() => synthesizeExecutiveCouncil({
      decision: 'Merge.',
      reports: [
        report(),
        report({
          id: 'report-operations',
          role: 'Operations Chief',
          domain: 'operations',
          workspaceId: 'other-workspace',
        }, 1),
      ],
      nextGate: 'Review.',
    }, NOW)).toThrow('Executive Council cannot mix specialist reports across workspaces or projects');
  });

  it('enforces lifecycle quality before reviewed or approved synthesis', () => {
    expect(() => synthesizeExecutiveCouncil({
      decision: 'Merge.',
      reports: [report({ status: 'draft' })],
      nextGate: 'Review.',
      status: 'reviewed',
    }, NOW)).toThrow('Reviewed council synthesis requires reviewed or approved specialist reports');

    expect(() => synthesizeExecutiveCouncil({
      decision: 'Merge.',
      reports: [report({ status: 'reviewed' })],
      nextGate: 'Review.',
      status: 'approved',
    }, NOW)).toThrow('Approved council synthesis requires approved specialist reports');

    expect(() => synthesizeExecutiveCouncil({
      decision: 'Merge.',
      reports: [report({ status: 'superseded' })],
      nextGate: 'Review.',
    }, NOW)).toThrow('Executive Council cannot use superseded specialist reports');
  });

  it('caps confidence when verified claims have no external source receipt', () => {
    const synthesis = synthesizeExecutiveCouncil({
      decision: 'Add the council contract.',
      reports: [report({
        id: 'report-product',
        role: 'Product Chief',
        domain: 'product',
        confidence: 95,
        reality: [{ state: 'verified', statement: 'Users need a single founder-ready conclusion.' }],
      }, 4)],
      nextGate: 'Review.',
    }, NOW);

    expect(synthesis.confidence.final).toBe(69);
    expect(synthesis.confidence.caps).toContainEqual({
      reason: 'unreferenced-verified-reality',
      value: 69,
    });
  });

  it('rejects unsupported council status instead of silently downgrading it', () => {
    expect(() => synthesizeExecutiveCouncil({
      decision: 'Merge.',
      reports: [report()],
      nextGate: 'Review.',
      status: 'mistyped',
    }, NOW)).toThrow('Council status is unsupported');
  });
});
