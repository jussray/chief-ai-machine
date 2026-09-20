import { describe, expect, it } from 'vitest';
import {
  PROMPTOS_FOUNDER_DECISION_POLICY_CONTRACT,
  strategicLensPolicies,
  strategicLensPolicy,
} from './strategic-lens.js';

describe('strategic lens authority boundary', () => {
  it('treats founder business/personality lenses as hypothesis generators only', () => {
    for (const id of ['hormozi', 'billgates', 'elonmusk', 'garyvee']) {
      expect(strategicLensPolicy(id)).toMatchObject({
        id,
        kind: 'hypothesis_generator',
        mayAffectReasoning: true,
        mayAffectAuthority: false,
        mayAuthorizeExecution: false,
        maySatisfyEvidence: false,
        mayImplementDecisionPolicyLocally: false,
      });
    }
  });

  it('binds Bill and Elon to the canonical PromptOS policy without copying authority', () => {
    for (const id of ['billgates', 'elonmusk']) {
      expect(strategicLensPolicy(id)).toMatchObject({
        id,
        decisionPolicyOwner: 'jussray/promptos',
        decisionPolicyContract: PROMPTOS_FOUNDER_DECISION_POLICY_CONTRACT,
        decisionPolicyBinding: 'reference-only',
        requiresSharedEvidence: true,
        requiresProjectProofAdapter: true,
        mayImplementDecisionPolicyLocally: false,
        mayAffectAuthority: false,
        mayAuthorizeExecution: false,
        maySatisfyEvidence: false,
      });
    }
  });

  it('does not bind unrelated strategic lenses to the executable PromptOS policy', () => {
    for (const id of ['hormozi', 'garyvee', 'ultrathink']) {
      expect(strategicLensPolicy(id)).toMatchObject({
        id,
        decisionPolicyOwner: null,
        decisionPolicyContract: null,
        decisionPolicyBinding: null,
        requiresSharedEvidence: false,
        requiresProjectProofAdapter: false,
      });
    }
  });

  it('keeps ordinary reasoning lenses non-authoritative too', () => {
    expect(strategicLensPolicy('/ultrathink')).toMatchObject({
      id: 'ultrathink',
      kind: 'reasoning_lens',
      mayAffectAuthority: false,
      mayAuthorizeExecution: false,
      maySatisfyEvidence: false,
    });
  });

  it('deduplicates lens labels without converting them into capabilities', () => {
    expect(strategicLensPolicies(['/garyvee', 'garyvee', 'redteam']).map((lens) => lens.id))
      .toEqual(['garyvee', 'redteam']);
  });
});