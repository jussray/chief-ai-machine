import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decisionCycleHash, validateDecisionCycle } from '../src/domain/decision-cycle.js';

const EXPECTED_HASH = '44912cf24230209d5f8f64cab39cfb424ea2178091d3b3c7462abd607d65c7a2';
const fixture = JSON.parse(
  readFileSync(new URL('../testdata/v10-decision-cycle-conformance.json', import.meta.url), 'utf8'),
);

describe('V10 cross-repo decision conformance', () => {
  it('creates the canonical identity consumed by PromptOS and independently rederived by FCR', () => {
    expect(validateDecisionCycle(fixture)).toEqual({ valid: true, errors: [] });
    expect(decisionCycleHash(fixture)).toBe(EXPECTED_HASH);
    expect(fixture.decisionHash).toBe(EXPECTED_HASH);
    expect(fixture.authorityCeiling).toBe('reason');
    expect(fixture.requiresFounderApproval).toBe(true);
    expect(fixture.executionAuthorized).toBe(false);
  });
});
