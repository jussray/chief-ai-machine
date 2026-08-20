import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  recursiveHardeningHash,
  validateRecursiveHardening,
} from '../src/domain/recursive-decision-hardening.js';

const EXPECTED_HARDENING_HASH = 'aa34b1c3810b9ddefee2d37cbddfe80335268a3f339ac5ab2cddea7b117a2f64';
const baseDecision = JSON.parse(
  readFileSync(new URL('../testdata/v10-decision-cycle-conformance.json', import.meta.url), 'utf8'),
);
const hardeningFixture = JSON.parse(
  readFileSync(new URL('../testdata/v10-recursive-hardening-conformance.json', import.meta.url), 'utf8'),
);

describe('V10 recursive hardening cross-repo conformance', () => {
  it('creates the canonical hardening identity preserved by PromptOS and independently rederived by FCR', () => {
    expect(validateRecursiveHardening(baseDecision, hardeningFixture)).toEqual({
      valid: true,
      authorityEligible: true,
      errors: [],
    });
    expect(recursiveHardeningHash(hardeningFixture)).toBe(EXPECTED_HARDENING_HASH);
    expect(hardeningFixture.hardeningHash).toBe(EXPECTED_HARDENING_HASH);
    expect(hardeningFixture.decisionHash).toBe(baseDecision.decisionHash);
    expect(hardeningFixture.cycles).toHaveLength(10);
    expect(hardeningFixture.cycles.every((cycle) => cycle.attacks.length === 4)).toBe(true);
    expect(hardeningFixture.executionAuthorized).toBe(false);
  });
});
