import { describe, expect, it } from 'vitest';
import {
  CONTROL_ROOM_RECOMMENDATION_CONTRACT,
  createControlRoomRecommendation,
} from './control-room-recommendation.js';

function input(overrides = {}) {
  return {
    projectName: "Se'kret Bip",
    projectType: 'ai-agent',
    mission: 'launch',
    currentState: 'live',
    repoIdentifier: 'jussray/Sekret-Bip',
    stack: 'Cloudflare + Supabase',
    ...overrides,
  };
}

describe('Chief Control Room onboarding recommendation', () => {
  it('creates a deterministic proposal-only recommendation for FCR', () => {
    const first = createControlRoomRecommendation(input());
    const second = createControlRoomRecommendation(input());

    expect(first).toMatchObject({
      contract: CONTROL_ROOM_RECOMMENDATION_CONTRACT,
      selectedBy: 'chief-ai-machine',
      project: {
        name: "Se'kret Bip",
        projectType: 'ai-agent',
        projectTypeLabel: 'AI / Agent System',
        mission: 'launch',
        missionLabel: 'Launch',
        currentState: 'live',
        currentStateLabel: 'Already live',
        repoIdentifier: 'jussray/Sekret-Bip',
        stack: 'Cloudflare + Supabase',
      },
      confidence: 'bounded-rule-match',
      founderDecision: {
        required: true,
        explicitDecisionOnly: true,
        accepted: false,
        createControlRoomAuthorized: false,
      },
      fcrHandoff: {
        stateAuthority: 'founder-control-room',
        evidenceAuthority: 'founder-control-room',
        executionAuthority: 'unresolved-by-chief-ai',
        preserveFounderDeclaredState: true,
        verifyRealityIndependently: true,
      },
    });
    expect(first.capabilityIntents).toEqual(['launch-readiness', 'proofmode', 'rollback-planning']);
    expect(first.evidencePriorities).toEqual(expect.arrayContaining([
      'exact release identity',
      'runtime/provider evidence',
      'model/tool boundary behavior',
      'authority and execution receipts',
    ]));
    expect(first.stateGuidance).toContain('current runtime/provider identity');
    expect(first.recommendationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.recommendationHash).toBe(second.recommendationHash);
    expect(first.boundaries.join(' ')).toContain('does not create or mutate Founder Control Room state');
  });

  it('changes the bound recommendation hash when founder-declared onboarding state changes', () => {
    const live = createControlRoomRecommendation(input({ currentState: 'live' }));
    const broken = createControlRoomRecommendation(input({ currentState: 'broken' }));

    expect(live.recommendationHash).not.toBe(broken.recommendationHash);
    expect(broken.stateGuidance).toContain('failing receipt');
  });

  it('matches FCR commerce/grow onboarding without implying transaction authority', () => {
    const recommendation = createControlRoomRecommendation(input({
      projectName: 'Juss Beautiful Hair',
      projectType: 'store-commerce',
      mission: 'grow',
      currentState: 'building',
      repoIdentifier: '',
      stack: 'Shopify',
    }));

    expect(recommendation.title).toContain('Store / Commerce');
    expect(recommendation.title).toContain('Grow');
    expect(recommendation.capabilityIntents).toEqual(['growth-analysis', 'experiment-design', 'outcome-review']);
    expect(recommendation.evidencePriorities).toEqual(expect.arrayContaining([
      'current baseline',
      'catalog and checkout path',
      'payment/order outcome evidence',
    ]));
    expect(recommendation.project.repoIdentifier).toBeNull();
    expect(recommendation.founderDecision.createControlRoomAuthorized).toBe(false);
  });

  it('fails closed for unsupported onboarding values or a missing project name', () => {
    expect(() => createControlRoomRecommendation(input({ projectName: '' })))
      .toThrow('Project name is required');
    expect(() => createControlRoomRecommendation(input({ projectType: 'mystery' })))
      .toThrow('Unsupported Control Room project type');
    expect(() => createControlRoomRecommendation(input({ mission: 'autopilot' })))
      .toThrow('Unsupported Control Room mission');
    expect(() => createControlRoomRecommendation(input({ currentState: 'probably-fine' })))
      .toThrow('Unsupported Control Room current state');
  });
});
