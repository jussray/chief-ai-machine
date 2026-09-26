// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { describe, expect, test } from 'vitest';
import {
  MODEL_EXECUTION_PLAN_CONTRACT,
  compileModelExecutionPlan,
  modelExecutionProfile,
} from './model-execution-profile.js';

function baseInput(profileId, observedRuntimeModel) {
  return {
    profileId,
    observedRuntimeModel,
    observedCapabilities: ['github', 'playwright'],
    sourceTruthRefs: ['repo:jussray/chief-ai-machine@exact-head', 'runtime:playwright-receipt'],
    authorityRequired: ['founder-for-separate-gates'],
    proofRequired: ['focused-tests', 'playwright-when-user-facing'],
    continuityFingerprint: 'sha256:example',
  };
}

describe('Chief model-native execution profiles', () => {
  test('Sol and Claude get different execution bias under the same truth contract', () => {
    const sol = compileModelExecutionPlan(baseInput('chatgpt-sol', 'gpt-5.6-sol'));
    const claude = compileModelExecutionPlan(baseInput('claude-code', 'claude-runtime-observed'));

    expect(sol.contract).toBe(MODEL_EXECUTION_PLAN_CONTRACT);
    expect(sol.executionBias).not.toEqual(claude.executionBias);
    expect(sol.sourceTruthRefs).toEqual(claude.sourceTruthRefs);
    expect(sol.mayAdapt).toEqual(claude.mayAdapt);
    expect(sol.mayNotAdapt).toEqual(claude.mayNotAdapt);
    expect(sol.mayAdapt.some((field) => sol.mayNotAdapt.includes(field))).toBe(false);
    expect(claude.mayAdapt.some((field) => claude.mayNotAdapt.includes(field))).toBe(false);
    expect(sol.truthSource).toBe('shared-evidence-spine');
    expect(claude.truthSource).toBe('shared-evidence-spine');
    expect(sol.toolUseRule).toBe('observed-only-no-simulation');
    expect(claude.toolUseRule).toBe('observed-only-no-simulation');
  });

  test('neither model profile can carry execution, authority, approval, or consensus proof', () => {
    for (const [profileId, runtime] of [
      ['chatgpt-sol', 'gpt-5.6-sol'],
      ['claude-code', 'claude-runtime-observed'],
    ]) {
      const plan = compileModelExecutionPlan(baseInput(profileId, runtime));
      expect(plan.executionAuthorized).toBe(false);
      expect(plan.authorityTransferred).toBe(false);
      expect(plan.founderApprovalCarriedForward).toBe(false);
      expect(plan.acceptsModelConsensusAsProof).toBe(false);
      expect(plan.requiresIndependentEvidenceForTruthUpgrade).toBe(true);
      expect(plan.mayNotAdapt).toEqual(expect.arrayContaining([
        'truth-state',
        'authority-state',
        'founder-approval',
        'proof-state',
        'project-canon',
      ]));
    }
  });

  test('fails closed when runtime identity, truth source, or continuity was not observed', () => {
    expect(() => compileModelExecutionPlan({
      ...baseInput('chatgpt-sol', 'gpt-5.6-sol'),
      observedRuntimeModel: '',
    })).toThrow('runtime_model_identity_required');

    expect(() => compileModelExecutionPlan({
      ...baseInput('claude-code', 'claude-runtime-observed'),
      sourceTruthRefs: [],
    })).toThrow('source_truth_reference_required');

    expect(() => compileModelExecutionPlan({
      ...baseInput('claude-code', 'claude-runtime-observed'),
      continuityFingerprint: '',
    })).toThrow('continuity_fingerprint_required');

    expect(modelExecutionProfile('unknown')).toBeNull();
    expect(() => compileModelExecutionPlan(baseInput('unknown', 'anything'))).toThrow('unknown_model_execution_profile');
  });

  test('records only observed capabilities and never invents unavailable tools', () => {
    const plan = compileModelExecutionPlan({
      ...baseInput('claude-code', 'claude-runtime-observed'),
      observedCapabilities: ['github', 'github', ''],
    });

    expect(plan.observedCapabilities).toEqual(['github']);
    expect(plan.observedCapabilities).not.toContain('playwright');
    expect(plan.toolUseRule).toBe('observed-only-no-simulation');
  });
});
