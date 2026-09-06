import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const operationalAuthority = JSON.parse(readFileSync(
  new globalThis.URL('../config/operational-authority.json', import.meta.url),
  'utf8',
));
const agents = readFileSync(
  new globalThis.URL('../AGENTS.md', import.meta.url),
  'utf8',
);
const constitution = readFileSync(
  new globalThis.URL('../docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md', import.meta.url),
  'utf8',
);

describe('TruthMode authority contract', () => {
  it('keeps the machine contract aligned with the canonical founder-intelligence doctrine', () => {
    expect(agents).toContain('/truthmode');
    expect(agents).toContain('separate verified fact, inference, risk, and unknowns');
    expect(constitution).toContain('## /truthmode');
    expect(constitution).toContain('Evidence outranks confidence.');
    expect(constitution).toContain('Never convert one layer into a claim about another.');

    expect(operationalAuthority.truthMode).toEqual({
      contract: 'chief/truthmode@v1',
      mode: 'read-only-claim-adjudication',
      proofPlanes: [
        'repository',
        'tests',
        'ci',
        'deployment',
        'runtime',
        'provider',
        'customer-outcome',
      ],
      classifications: [
        'VERIFIED',
        'INFERRED',
        'RISK',
        'UNKNOWN',
        'BLOCKED',
        'HISTORICAL',
      ],
      rules: {
        evidenceOutranksConfidence: true,
        proofPlanesMayNotUpgradeOneAnother: true,
        historicalTruthIsImmutable: true,
        currentTruthRequiresReobservation: true,
        unknownOrMissingEvidenceFailsClosed: true,
        cannotGrantExecutionAuthority: true,
        cannotGrantMergeAuthority: true,
        cannotGrantDeployAuthority: true,
        cannotGrantProviderMutationAuthority: true,
        cannotGrantPublicationAuthority: true,
      },
    });
  });
});
