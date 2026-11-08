import { describe, expect, it } from 'vitest';
import { assessActiveDefenseEvidence } from './active-defense-assessment.js';

const flows = [
  'attack10', 'attack20', 'attack30', 'attack3000', 'attack5000', 'attack6000',
  'attack48000', 'redteamI', 'redteamII', 'redteamTwin', 'devil', 'lindymode',
  'l99', 'ooda', 'truthmode', 'confess', 'goalfix', 'proofMode', 'continuity', 'rollback',
];

function evidence(overrides = {}) {
  return {
    contract: 'juss/active-defense@v1',
    verdict: 'HALLWAY',
    actorFingerprint: 'a'.repeat(64),
    incidentFingerprint: 'b'.repeat(64),
    risk: 88,
    logicalExpansion: 72000,
    attackUnit: flows.map((flow) => ({ flow, score: 10, finding: 'bounded check' })),
    controls: {
      outboundProbe: false,
      productionExposure: 0,
      realCredentialsExposed: 0,
      customerDataExposed: 0,
    },
    ...overrides,
  };
}

describe('active defense assessment', () => {
  it('recommends bounded hallway continuation only with complete safe evidence', () => {
    const result = assessActiveDefenseEvidence(evidence());
    expect(result.recommendation).toBe('CONTINUE_BOUNDED_HALLWAY');
    expect(result.evidenceComplete).toBe(true);
    expect(result.boundarySafe).toBe(true);
    expect(result.authority.recommendationOnly).toBe(true);
    expect(result.authority.canProbeThirdParty).toBe(false);
  });

  it('fails to containment when a required lens is missing', () => {
    const result = assessActiveDefenseEvidence(evidence({
      attackUnit: flows.slice(1).map((flow) => ({ flow, score: 10 })),
    }));
    expect(result.recommendation).toBe('CONTAIN_ONLY');
    expect(result.missingFlows).toContain('attack10');
  });

  it('fails to containment when boundary controls are widened', () => {
    const result = assessActiveDefenseEvidence(evidence({
      controls: {
        outboundProbe: true,
        productionExposure: 0,
        realCredentialsExposed: 0,
        customerDataExposed: 0,
      },
    }));
    expect(result.recommendation).toBe('CONTAIN_ONLY');
    expect(result.boundarySafe).toBe(false);
  });
});
