import { describe, expect, it } from 'vitest';
import {
  FOUNDER_MISSION_CORE_ARTIFACT_IDS,
  FOUNDER_MISSION_ENVELOPE_CONTRACT,
  compileFcrWorkflowCandidate,
  createFounderMissionPlan,
  createFounderMissionPlanSuccessor,
  founderMissionFingerprint,
  isActionIdSyntaxValid,
  validateFounderMissionPlan,
} from './founder-mission-plan.js';

function basePlan(overrides = {}) {
  return createFounderMissionPlan({
    missionId: 'mission-001',
    goal: 'Turn one repeated founder task into a proved reusable workflow.',
    preservedConstraints: ['FCR and Chief remain standalone peers.'],
    who: 'Founder owns final authority; Chief plans; FCR proves and executes.',
    what: 'One bounded workflow candidate.',
    where: 'jussray/chief-ai-machine + jussray/founder-control-room',
    when: 'Current exact candidate only.',
    why: 'Reduce founder repetition without collapsing the Twin Core.',
    how: 'Decompose, route, prove, then hand durable execution to FCR.',
    systemMap: ['chief-ai -> mission plan', 'fcr -> guarded execution'],
    redTeamRegister: ['identity collapse', 'false green', 'provider lock-in'],
    bottleneckMap: ['required proof gate'],
    requestedActionIds: ['verify:frontend'],
    requiredProofLevel: 'exact-head',
    currentProofLevel: 'plan-only',
    taskState: 'open',
    proofState: 'unproven',
    rollback: 'Discard or supersede this plan; it authorizes no external action.',
    createdAt: '2026-09-25T00:00:00.000Z',
    ...overrides,
  });
}

describe('Chief founder mission planning', () => {
  it('creates the complete Bip-derived artifact spine while keeping role ownership distinct', () => {
    const plan = basePlan();
    expect(plan.contract).toBe(FOUNDER_MISSION_ENVELOPE_CONTRACT);
    expect(plan.selectedBy).toBe('chief-ai-machine');
    expect(validateFounderMissionPlan(plan)).toEqual({ valid: true, errors: [] });
    expect(plan.artifacts.map((artifact) => artifact.artifactId)).toEqual([...FOUNDER_MISSION_CORE_ARTIFACT_IDS]);
    expect(plan.artifacts.find((artifact) => artifact.artifactId === 'mission-brief')?.ownerLane).toBe('chief-ai');
    expect(plan.artifacts.find((artifact) => artifact.artifactId === 'verification-report')?.ownerLane).toBe('founder-control-room');
    expect(plan.artifacts.find((artifact) => artifact.artifactId === 'founder-decision-pack')?.ownerLane).toBe('founder');
    expect(plan.authorizesExecution).toBe(false);
    expect(plan.authorizesClearance).toBe(false);
  });

  it('rejects any attempt by Chief to become final proof or task-clearance authority', () => {
    const proven = basePlan({ proofState: 'proven', taskState: 'proven' });
    const result = validateFounderMissionPlan(proven);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Chief cannot self-assert final proven/cleared task state');
    expect(result.errors).toContain('Chief cannot self-assert final proof state');

    const forged = { ...basePlan(), authorizesExecution: true, authorizesClearance: true };
    const forgedResult = validateFounderMissionPlan(forged);
    expect(forgedResult.errors).toContain('Chief mission plans cannot authorize execution');
    expect(forgedResult.errors).toContain('Chief mission plans cannot authorize task clearance');
  });

  it('keeps append-only mission lineage and mission identity', () => {
    const first = basePlan();
    const successor = createFounderMissionPlanSuccessor(first, {
      currentProofLevel: 'local-evidence',
      createdAt: '2026-09-25T00:01:00.000Z',
    });

    expect(first.version).toBe(1);
    expect(successor.version).toBe(2);
    expect(successor.predecessorFingerprint).toBe(first.missionFingerprint);
    expect(successor.missionFingerprint).not.toBe(first.missionFingerprint);
    expect(validateFounderMissionPlan(successor)).toEqual({ valid: true, errors: [] });
    expect(() => createFounderMissionPlanSuccessor(first, { missionId: 'new-mission' })).toThrow(
      'mission identity cannot change across append-only successors',
    );
  });

  it('accepts only bounded action-ID syntax and leaves registry membership to FCR', () => {
    expect(isActionIdSyntaxValid('verify:frontend')).toBe(true);
    expect(isActionIdSyntaxValid('recover-system')).toBe(true);
    expect(isActionIdSyntaxValid('npm run test')).toBe(false);
    expect(isActionIdSyntaxValid('verify; rm -rf /')).toBe(false);

    const rawCommandPlan = basePlan({ requestedActionIds: ['npm run test'] });
    expect(validateFounderMissionPlan(rawCommandPlan).errors).toContain('invalid/free-form action identifier syntax: npm run test');
  });

  it('compiles an FCR workflow candidate without donating Chief identity or authority', () => {
    const plan = basePlan();
    const candidate = compileFcrWorkflowCandidate(plan, {
      workflowId: 'repair-my-app',
      publicLabel: 'Repair my app',
      userOutcome: 'A bounded app defect is repaired and proved at the required level.',
      sourceProject: 'founder-control-room',
      lane: 'repair',
      northStar: 'Smallest reversible fix with truthful proof.',
      internalStack: ['ultrathink', 'truthmode', 'goalfix', 'playwright'],
      inputs: ['project', 'goal'],
      outputs: ['repair receipt'],
      authorityRequired: ['repository write'],
      connectedTools: ['github'],
      modelRoute: ['openai', 'anthropic'],
      councilRoute: ['builder', 'challenger'],
      proofRequired: ['exact-head tests'],
      rollback: ['revert focused commit'],
      privacyClass: 'founder-operations',
      costBudget: 'bounded',
      successSignal: ['required checks pass'],
      failureSignal: ['proof remains pending'],
      repeatabilityEvidence: ['same repair pattern recurs'],
    });

    const { candidateFingerprint, ...candidatePayload } = candidate;
    expect(candidate.compiledBy).toBe('chief-ai-machine');
    expect(candidate.sourceMissionFingerprint).toBe(plan.missionFingerprint);
    expect(candidate.publicLabel).toBe('Repair my app');
    expect(candidate.authorizesExecution).toBe(false);
    expect(candidate.authorizesClearance).toBe(false);
    expect(candidate.taskClearanceRule).toContain('FCR clears only after required proof is proven');
    expect(candidateFingerprint).toBe(founderMissionFingerprint(candidatePayload));
  });
});
