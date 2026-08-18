import { describe, expect, it } from 'vitest';
import {
  DECISION_CYCLE_CONTRACT,
  V10_DECISION_LENSES,
  createDecisionCycle,
  decisionCycleHash,
  validateDecisionCycle,
} from './decision-cycle.js';

const SHA = 'a'.repeat(40);

function lensReports() {
  return V10_DECISION_LENSES.map((lens) => ({
    lens,
    finding: `${lens} finding grounded in bounded evidence.`,
    recommendation: `${lens} recommends the smallest reversible next move.`,
    confidence: lens === 'truthmode' ? 0.8 : 0.7,
    evidenceRefs: [`evidence:${lens}`],
    assumptions: [`assumption:${lens}`],
    risks: [`risk:${lens}`],
    blockers: [],
    requestedEvidence: [`proof:${lens}`],
    metrics: lens === 'data-analytics'
      ? [{ name: 'time-to-proof', baseline: 'unknown', target: 'decrease', source: 'FCR receipts' }]
      : [],
  }));
}

function baseDecision(overrides = {}) {
  return createDecisionCycle({
    goal: 'Sharpen the Business OS without creating competing authority.',
    workspaceId: 'juss-portfolio',
    projectSlug: 'chief-ai-machine',
    expectedHeadSha: SHA,
    customerOutcome: 'One clear founder decision with evidence, dissent, authority, proof, and next move.',
    desiredState: 'Parallel analysis produces one auditable proposal that downstream systems can verify.',
    currentState: 'Strategic lenses exist but do not yet share one deterministic decision receipt.',
    bottleneck: 'Reasoning quality is not yet represented as a portable cross-system contract.',
    decisionClass: 'reversible',
    reality: {
      verified: ['Chief owns capability composition and FCR owns execution authority.'],
      inferred: ['A shared decision receipt should reduce cross-system reinterpretation.'],
      unknown: ['External founder retention impact is not yet measured.'],
      blocked: [],
    },
    lensReports: lensReports(),
    dissent: ['Redteam wants stricter stop conditions before any authority expansion.'],
    candidateOptions: [
      'Keep strategic lenses informal.',
      'Add one deterministic V10 decision-cycle contract.',
    ],
    recommendation: 'Add the decision-cycle contract as proposal-only input to the existing capability and mission pipeline.',
    proofRequirements: ['focused unit tests', 'exact-head CI'],
    outcomeSignals: ['time-to-proof', 'founder-override-rate', 'decision-reopen-rate'],
    rollback: 'Revert the isolated contract branch; no provider or production state changes.',
    stopConditions: ['hash mismatch', 'missing required lens', 'authority expansion', 'evidence contradiction'],
    nextGate: 'PromptOS may consume only a validated decision receipt without granting execution authority.',
    ...overrides,
  });
}

describe('V10 parallel decision cycle', () => {
  it('creates a deterministic proposal-only decision receipt with every required lens', () => {
    const cycle = baseDecision();

    expect(cycle.contract).toBe(DECISION_CYCLE_CONTRACT);
    expect(cycle.authorityCeiling).toBe('reason');
    expect(cycle.requiresFounderApproval).toBe(true);
    expect(cycle.executionAuthorized).toBe(false);
    expect(cycle.lensReports.map((report) => report.lens).sort()).toEqual([...V10_DECISION_LENSES].sort());
    expect(cycle.decisionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(decisionCycleHash(cycle)).toBe(cycle.decisionHash);
    expect(validateDecisionCycle(cycle)).toEqual({ valid: true, errors: [] });
  });

  it('changes identity when evidence, recommendation, or outcome contract changes', () => {
    const first = baseDecision();
    const evidenceChanged = baseDecision({
      reality: { verified: ['Different verified state.'], inferred: [], unknown: [], blocked: [] },
    });
    const recommendationChanged = baseDecision({ recommendation: 'Do not implement yet.' });
    const outcomeChanged = baseDecision({ outcomeSignals: ['different-signal'] });

    expect(evidenceChanged.decisionHash).not.toBe(first.decisionHash);
    expect(recommendationChanged.decisionHash).not.toBe(first.decisionHash);
    expect(outcomeChanged.decisionHash).not.toBe(first.decisionHash);
  });

  it('fails closed when a required lens is missing', () => {
    expect(() => baseDecision({
      lensReports: lensReports().filter((report) => report.lens !== 'redteam'),
    })).toThrow('Required V10 decision lens missing: redteam');
  });

  it('preserves dissent instead of turning parallel analysis into false consensus', () => {
    const cycle = baseDecision({
      dissent: [
        'FutureYou prefers durability before expansion.',
        'Elonmusk lens prefers deleting one layer first.',
      ],
    });

    expect(cycle.dissent).toEqual([
      'Elonmusk lens prefers deleting one layer first.',
      'FutureYou prefers durability before expansion.',
    ]);
  });

  it('keeps /steal evidence-bound rather than cargo-culting an external mechanism', () => {
    const reports = lensReports().map((report) => report.lens === 'steal'
      ? {
          ...report,
          finding: 'A proven external mechanism is useful only when its source and local adaptation are explicit.',
          evidenceRefs: ['primary-source:operating-mechanism'],
          assumptions: ['The mechanism fits this local failure mode.'],
          requestedEvidence: ['local A/B or workflow proof'],
        }
      : report);
    const cycle = baseDecision({ lensReports: reports });
    const steal = cycle.lensReports.find((report) => report.lens === 'steal');

    expect(steal.evidenceRefs).toContain('primary-source:operating-mechanism');
    expect(steal.requestedEvidence).toContain('local A/B or workflow proof');
  });

  it('rejects tampering and cannot be converted into execution authority', () => {
    const cycle = baseDecision();
    const tampered = { ...cycle, recommendation: 'Different recommendation.' };
    const escalated = { ...cycle, authorityCeiling: 'privileged', executionAuthorized: true };

    expect(validateDecisionCycle(tampered).errors).toContain('Decision cycle hash does not match decision content');
    expect(validateDecisionCycle(escalated).errors).toContain('V10 decision cycle authority ceiling must remain reason');
    expect(validateDecisionCycle(escalated).errors).toContain('Decision cycle cannot authorize execution');
  });
});
