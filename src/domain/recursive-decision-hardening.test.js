import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  RECURSIVE_ATTACK_MODES,
  RECURSIVE_REQUIRED_SKILLS,
  createRecursiveHardening,
  recursiveHardeningHash,
  validateRecursiveHardening,
} from './recursive-decision-hardening.js';

const baseDecision = JSON.parse(
  readFileSync(new URL('../../testdata/v10-decision-cycle-conformance.json', import.meta.url), 'utf8'),
);
const hardeningFixture = JSON.parse(
  readFileSync(new URL('../../testdata/v10-recursive-hardening-conformance.json', import.meta.url), 'utf8'),
);

describe('V10 recursive decision hardening', () => {
  it('requires four distinct attacks across ten chained Red Team/OODA cycles', () => {
    const result = validateRecursiveHardening(baseDecision, hardeningFixture);
    expect(result).toEqual({ valid: true, authorityEligible: true, errors: [] });
    expect(hardeningFixture.cycles).toHaveLength(10);
    for (const cycle of hardeningFixture.cycles) {
      expect(cycle.attacks.map((attack) => attack.mode).sort()).toEqual([...RECURSIVE_ATTACK_MODES].sort());
      const skills = new Set(cycle.attacks.flatMap((attack) => attack.skills));
      expect(skills.has('redteam')).toBe(true);
      expect(skills.has('ooda')).toBe(true);
    }
    expect(RECURSIVE_REQUIRED_SKILLS.every((skill) => hardeningFixture.skillsCovered.includes(skill))).toBe(true);
  });

  it('binds every cycle to the conclusion produced by the prior cycle', () => {
    const stale = structuredClone(hardeningFixture);
    stale.cycles[6].inputConclusionHash = 'f'.repeat(64);
    stale.hardeningHash = recursiveHardeningHash(stale);
    const result = validateRecursiveHardening(baseDecision, stale);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Recursive hardening cycle 7 input conclusion is stale');
  });

  it('rejects four copies of one attack disguised as four-way falsification', () => {
    const duplicate = structuredClone(hardeningFixture);
    duplicate.cycles[0].attacks[1].mode = duplicate.cycles[0].attacks[0].mode;
    duplicate.cycles[0].attacks[1].finding = duplicate.cycles[0].attacks[0].finding;
    duplicate.hardeningHash = recursiveHardeningHash(duplicate);
    const result = validateRecursiveHardening(baseDecision, duplicate);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('repeats attack mode'))).toBe(true);
    expect(result.errors.some((error) => error.includes('repeats an attack finding'))).toBe(true);
  });

  it('keeps revised conclusions non-authorizing until a new first conclusion is attacked again', () => {
    const revisedConclusion = 'Use a new conclusion and restart recursive hardening before authority resolution.';
    const revisedCycles = structuredClone(hardeningFixture.cycles);
    const revisedHash = createHash('sha256').update(revisedConclusion).digest('hex');

    revisedCycles.forEach((cycle, index) => {
      cycle.inputConclusionHash = index === 0 ? hardeningFixture.initialConclusionHash : revisedHash;
      cycle.outputConclusion = revisedConclusion;
      cycle.outputConclusionHash = revisedHash;
      cycle.decision = index === 0 ? 'revised' : 'survived';
      cycle.attacks = cycle.attacks.map((attack, attackIndex) => ({
        ...attack,
        disposition: index === 0 && attackIndex === 0 ? 'revised' : 'survived',
      }));
    });

    const receipt = createRecursiveHardening(baseDecision, {
      attackModes: hardeningFixture.attackModes,
      cycles: revisedCycles,
      finalConclusion: revisedConclusion,
      finalConclusionHash: revisedHash,
      finalDisposition: 'revised',
      skillsCovered: hardeningFixture.skillsCovered,
    });
    const result = validateRecursiveHardening(baseDecision, receipt);
    expect(result.valid).toBe(true);
    expect(result.authorityEligible).toBe(false);
  });

  it('cannot turn recursive reasoning into execution authority', () => {
    const escalated = {
      ...hardeningFixture,
      authorityCeiling: 'privileged',
      requiresFounderApproval: false,
      executionAuthorized: true,
    };
    escalated.hardeningHash = recursiveHardeningHash(escalated);
    const result = validateRecursiveHardening(baseDecision, escalated);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Recursive hardening cannot exceed reason authority');
    expect(result.errors).toContain('Recursive hardening must preserve founder approval');
    expect(result.errors).toContain('Recursive hardening cannot authorize execution');
  });
});
