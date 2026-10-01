import { describe, expect, it } from 'vitest';
import { ATTACK_1000_BUDGET, evaluateChallengeBuild } from './challenge-builder-v1.js';

const fingerprint = 'challenge-build-v1';

function verifiedCycle(overrides = {}) {
  return {
    subjectFingerprint: fingerprint,
    premiseChallenge: {
      premise: 'The existing system assumes provider acceptance proves success.',
      alternative: 'Require independent outcome evidence before completion.',
      ref: 'proof://premise',
    },
    construction: {
      artifactFingerprint: 'artifact-v2',
      ref: 'proof://artifact-v2',
    },
    adversarialTesting: {
      budget: ATTACK_1000_BUDGET,
      falsifier: 'Independent outcome evidence shows the alternative produces no trust improvement.',
      hardCases: true,
      ref: 'proof://attack-1000',
    },
    evidenceAcceptance: {
      decision: 'revise',
      contraryEvidenceReviewed: true,
      ref: 'proof://decision',
    },
    recursiveRevision: {
      disposition: 'revised',
      previousFingerprint: 'artifact-v1',
      currentFingerprint: 'artifact-v2',
      ref: 'proof://revision',
    },
    ...overrides,
  };
}

describe('Challenge Builder v1', () => {
  it('verifies only a complete evidence-bound challenge-build cycle', () => {
    const result = evaluateChallengeBuild(verifiedCycle());

    expect(result.classification).toBe('VERIFIED');
    expect(result.challengeBuildVerified).toBe(true);
    expect(result.score).toBe(5);
    expect(result.maxScore).toBe(5);
    expect(result.selfAuthorize).toBe(false);
    expect(result.identityClaimAllowed).toBe(false);
  });

  it('does not confuse criticism with challenge building', () => {
    const result = evaluateChallengeBuild({
      subjectFingerprint: fingerprint,
      premiseChallenge: {
        premise: 'The premise is wrong.',
        alternative: 'Try another model.',
        ref: 'proof://critique',
      },
      method: { critiqueWithoutBuild: true },
    });

    expect(result.classification).toBe('REJECTED_METHOD');
    expect(result.challengeBuildVerified).toBe(false);
    expect(result.dimensions.construction.verified).toBe(false);
  });

  it('does not treat the Attack 1000 label as proof by itself', () => {
    const result = evaluateChallengeBuild(verifiedCycle({
      adversarialTesting: {
        budget: ATTACK_1000_BUDGET,
      },
    }));

    expect(result.classification).toBe('INCOMPLETE');
    expect(result.dimensions.adversarialTesting.verified).toBe(false);
    expect(result.attack1000.active).toBe(true);
    expect(result.attack1000.evidenceBound).toBe(false);
    expect(result.attack1000.claimedExternalTestCount).toBe(null);
  });

  it('rejects cherry-picking even when all five dimensions are populated', () => {
    const result = evaluateChallengeBuild(verifiedCycle({
      method: { cherryPickedEvidence: true },
    }));

    expect(result.score).toBe(5);
    expect(result.classification).toBe('REJECTED_METHOD');
    expect(result.challengeBuildVerified).toBe(false);
  });

  it('rejects safety or authority bypass as a hard boundary', () => {
    const result = evaluateChallengeBuild(verifiedCycle({
      boundaries: { authorityViolation: true },
    }));

    expect(result.classification).toBe('REJECTED_BOUNDARY');
    expect(result.boundaryBlocked).toBe(true);
    expect(result.challengeBuildVerified).toBe(false);
  });

  it('requires a real fingerprint change when revision is claimed', () => {
    const result = evaluateChallengeBuild(verifiedCycle({
      recursiveRevision: {
        disposition: 'revised',
        previousFingerprint: 'artifact-v1',
        currentFingerprint: 'artifact-v1',
        ref: 'proof://revision',
      },
    }));

    expect(result.classification).toBe('INCOMPLETE');
    expect(result.dimensions.recursiveRevision.verified).toBe(false);
    expect(result.dimensions.recursiveRevision.missing).toContain('changed fingerprint for revised disposition');
  });

  it('allows evidence to kill the build and still complete the challenge-build cycle', () => {
    const result = evaluateChallengeBuild(verifiedCycle({
      evidenceAcceptance: {
        decision: 'kill',
        contraryEvidenceReviewed: true,
        ref: 'proof://kill-decision',
      },
      recursiveRevision: {
        disposition: 'killed',
        previousFingerprint: 'artifact-v1',
        ref: 'proof://killed-artifact',
      },
    }));

    expect(result.classification).toBe('VERIFIED');
    expect(result.invariants.evidenceCanKillTheBuild).toBe(true);
  });

  it('allows evidence-backed reaffirmation without pretending a change occurred', () => {
    const result = evaluateChallengeBuild(verifiedCycle({
      evidenceAcceptance: {
        decision: 'keep',
        contraryEvidenceReviewed: true,
        ref: 'proof://keep-decision',
      },
      recursiveRevision: {
        disposition: 'reaffirmed',
        previousFingerprint: 'artifact-v1',
        currentFingerprint: 'artifact-v1',
        ref: 'proof://reaffirmed',
      },
    }));

    expect(result.classification).toBe('VERIFIED');
    expect(result.dimensions.recursiveRevision.verified).toBe(true);
  });
});
