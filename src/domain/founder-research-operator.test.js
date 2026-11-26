import { describe, expect, it } from 'vitest';
import {
  FOUNDER_RESEARCH_OPERATOR_CONTRACT,
  RESEARCH_DEPLOYMENT_CONTEXTS,
  createFounderResearchTask,
  validateFounderResearchTask,
} from './founder-research-operator.js';

const NOW = new Date('2026-11-26T03:00:00.000Z');

const BASE_INPUT = {
  id: 'research-chief-boundaries',
  goal: 'Verify the separation between Chief research, Chief command, and FCR authority.',
  deploymentContext: 'standalone',
  scope: ['Chief domain contracts', 'FCR handoff boundary'],
  sources: [{
    ref: 'repo:src/domain/evidence-decision-loop.js',
    kind: 'repository-file',
    trust: 'repository',
    capturedAt: NOW.toISOString(),
  }],
  findings: [{
    state: 'VERIFIED',
    statement: 'Chief research findings reuse the shared evidence claim states.',
    sourceRefs: ['repo:src/domain/evidence-decision-loop.js'],
    confidence: 95,
  }],
  redTeam: [{
    risk: 'A research result could be mistaken for permission to execute.',
    severity: 'high',
    falsifier: 'A downstream consumer accepts a research handoff as execution approval.',
    mitigation: 'Keep executionAuthority false and require FCR decision evidence.',
  }],
};

describe('Founder Research & Verification Operator', () => {
  it('creates a bounded, evidence-backed standalone research task', () => {
    const task = createFounderResearchTask(BASE_INPUT, NOW);

    expect(task.contract).toBe(FOUNDER_RESEARCH_OPERATOR_CONTRACT);
    expect(task.role).toBe('Founder Research & Verification Operator');
    expect(task.domain).toBe(RESEARCH_DEPLOYMENT_CONTEXTS.standalone);
    expect(task.authority).toMatchObject({
      mode: 'research-only',
      mayRead: true,
      mayCompare: true,
      mayVerify: true,
      mayWriteExternally: false,
      mayPublish: false,
      maySpend: false,
      mayDeploy: false,
      mayMerge: false,
      mayChangeAccess: false,
      requiresFounderControlRoomDecisionForConsequentialAction: true,
    });
    expect(task.handoff).toMatchObject({
      to: 'chief',
      evidenceConsumer: 'founder-control-room',
      promptPolicyOwner: 'promptos',
      continuityOwner: 'solcontinuity',
      executionAuthority: false,
      founderDecisionRequired: true,
    });
    expect(validateFounderResearchTask(task)).toEqual({ valid: true, errors: [] });
  });

  it('uses the same operator contract for the FCR-branded Chief context', () => {
    const task = createFounderResearchTask({
      ...BASE_INPUT,
      deploymentContext: 'fcr',
    }, NOW);

    expect(task.contract).toBe(FOUNDER_RESEARCH_OPERATOR_CONTRACT);
    expect(task.domain).toBe(RESEARCH_DEPLOYMENT_CONTEXTS.fcr);
  });

  it('rejects a verified claim without source evidence', () => {
    expect(() => createFounderResearchTask({
      ...BASE_INPUT,
      findings: [{
        state: 'VERIFIED',
        statement: 'This claim has no provenance.',
        sourceRefs: [],
        confidence: 100,
      }],
    }, NOW)).toThrow('Finding 1 in state VERIFIED requires source evidence');
  });

  it('rejects findings that cite a source not present in the task', () => {
    expect(() => createFounderResearchTask({
      ...BASE_INPUT,
      findings: [{
        state: 'OBSERVED',
        statement: 'The referenced source was not captured.',
        sourceRefs: ['missing-source'],
        confidence: 70,
      }],
    }, NOW)).toThrow('Finding 1 references an unknown source: missing-source');
  });

  it('rejects a domain that does not match its deployment context', () => {
    const task = createFounderResearchTask(BASE_INPUT, NOW);
    expect(validateFounderResearchTask({
      ...task,
      domain: RESEARCH_DEPLOYMENT_CONTEXTS.fcr,
    })).toEqual({
      valid: false,
      errors: ['Research domain does not match its deployment context'],
    });
  });

  it('rejects authority escalation even when the rest of the task is valid', () => {
    const task = createFounderResearchTask(BASE_INPUT, NOW);
    expect(validateFounderResearchTask({
      ...task,
      authority: { ...task.authority, mayMerge: true },
    })).toEqual({
      valid: false,
      errors: ['Research operator authority must remain read-only and non-executing'],
    });
  });

  it('fails closed on malformed finding references instead of throwing a validator error', () => {
    const task = createFounderResearchTask({
      ...BASE_INPUT,
      findings: [{
        state: 'UNKNOWN',
        statement: 'No source was available.',
        sourceRefs: [],
        confidence: 0,
      }],
    }, NOW);
    expect(validateFounderResearchTask({
      ...task,
      findings: [{ ...task.findings[0], sourceRefs: undefined }],
    }).valid).toBe(false);
  });

  it('requires a falsifier and mitigation for red-team findings', () => {
    expect(() => createFounderResearchTask({
      ...BASE_INPUT,
      redTeam: [{ risk: 'A claim may be wrong.', severity: 'high' }],
    }, NOW)).toThrow('Red-team finding 1 requires a falsifier');
  });
});
