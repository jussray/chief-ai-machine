import { describe, expect, it } from 'vitest';
import { strategicLensPolicies, strategicLensPolicy } from './strategic-lens.js';

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
