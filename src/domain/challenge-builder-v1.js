export const CHALLENGE_BUILDER_CONTRACT = 'juss/challenge-builder@v1';
export const ATTACK_1000_BUDGET = 'ATTACK_1000';

export const CHALLENGE_BUILDER_DIMENSIONS = Object.freeze([
  'premiseChallenge',
  'construction',
  'adversarialTesting',
  'evidenceAcceptance',
  'recursiveRevision',
]);

export const CHALLENGE_BUILDER_CLASSIFICATIONS = Object.freeze([
  'INCOMPLETE',
  'REJECTED_METHOD',
  'REJECTED_BOUNDARY',
  'VERIFIED',
]);

const EVIDENCE_DECISIONS = Object.freeze(['keep', 'revise', 'kill', 'unresolved']);
const REVISION_DISPOSITIONS = Object.freeze(['revised', 'killed', 'reaffirmed']);

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function dimension(verified, missing = []) {
  return {
    verified: Boolean(verified),
    missing: missing.filter(Boolean),
  };
}

function evaluatePremiseChallenge(value = {}) {
  const premise = text(value.premise);
  const alternative = text(value.alternative);
  const ref = text(value.ref);
  const missing = [];
  if (!premise) missing.push('premise');
  if (!alternative) missing.push('alternative');
  if (!ref) missing.push('ref');
  return dimension(missing.length === 0, missing);
}

function evaluateConstruction(value = {}) {
  const artifactFingerprint = text(value.artifactFingerprint);
  const ref = text(value.ref);
  const missing = [];
  if (!artifactFingerprint) missing.push('artifactFingerprint');
  if (!ref) missing.push('ref');
  return dimension(missing.length === 0, missing);
}

function evaluateAdversarialTesting(value = {}) {
  const falsifier = text(value.falsifier);
  const ref = text(value.ref);
  const attack1000 = value.budget === ATTACK_1000_BUDGET;
  const hardCases = value.hardCases === true;
  const missing = [];
  if (!attack1000) missing.push('ATTACK_1000 budget');
  if (!falsifier) missing.push('falsifier');
  if (!hardCases) missing.push('hardCases');
  if (!ref) missing.push('ref');
  return dimension(missing.length === 0, missing);
}

function evaluateEvidenceAcceptance(value = {}) {
  const decision = EVIDENCE_DECISIONS.includes(value.decision) ? value.decision : null;
  const contraryEvidenceReviewed = value.contraryEvidenceReviewed === true;
  const ref = text(value.ref);
  const missing = [];
  if (!decision) missing.push('decision');
  if (!contraryEvidenceReviewed) missing.push('contraryEvidenceReviewed');
  if (!ref) missing.push('ref');
  return dimension(missing.length === 0, missing);
}

function evaluateRecursiveRevision(value = {}) {
  const disposition = REVISION_DISPOSITIONS.includes(value.disposition) ? value.disposition : null;
  const previousFingerprint = text(value.previousFingerprint);
  const currentFingerprint = text(value.currentFingerprint);
  const ref = text(value.ref);
  const missing = [];

  if (!disposition) missing.push('disposition');
  if (!previousFingerprint) missing.push('previousFingerprint');
  if (!ref) missing.push('ref');

  if (disposition === 'revised') {
    if (!currentFingerprint) missing.push('currentFingerprint');
    if (previousFingerprint && currentFingerprint && previousFingerprint === currentFingerprint) {
      missing.push('changed fingerprint for revised disposition');
    }
  }

  if (disposition === 'reaffirmed') {
    if (!currentFingerprint) missing.push('currentFingerprint');
    if (previousFingerprint && currentFingerprint && previousFingerprint !== currentFingerprint) {
      missing.push('matching fingerprint for reaffirmed disposition');
    }
  }

  return dimension(missing.length === 0, missing);
}

export function evaluateChallengeBuild(input = {}) {
  const subjectFingerprint = text(input.subjectFingerprint);
  const errors = [];
  if (!subjectFingerprint) errors.push('subjectFingerprint is required');

  const dimensions = {
    premiseChallenge: evaluatePremiseChallenge(input.premiseChallenge),
    construction: evaluateConstruction(input.construction),
    adversarialTesting: evaluateAdversarialTesting(input.adversarialTesting),
    evidenceAcceptance: evaluateEvidenceAcceptance(input.evidenceAcceptance),
    recursiveRevision: evaluateRecursiveRevision(input.recursiveRevision),
  };

  const boundaryViolations = {
    safetyViolation: input.boundaries?.safetyViolation === true,
    authorityViolation: input.boundaries?.authorityViolation === true,
  };
  const boundaryBlocked = Object.values(boundaryViolations).some(Boolean);

  const methodFailures = {
    goalpostsMoved: input.method?.goalpostsMoved === true,
    cherryPickedEvidence: input.method?.cherryPickedEvidence === true,
    easyCasesOnly: input.method?.easyCasesOnly === true,
    noveltyOnly: input.method?.noveltyOnly === true,
    critiqueWithoutBuild: input.method?.critiqueWithoutBuild === true,
  };
  const methodRejected = Object.values(methodFailures).some(Boolean);

  const score = CHALLENGE_BUILDER_DIMENSIONS.reduce(
    (total, name) => total + (dimensions[name].verified ? 1 : 0),
    0,
  );
  const complete = score === CHALLENGE_BUILDER_DIMENSIONS.length;

  let classification = 'INCOMPLETE';
  if (boundaryBlocked) classification = 'REJECTED_BOUNDARY';
  else if (methodRejected) classification = 'REJECTED_METHOD';
  else if (complete && errors.length === 0) classification = 'VERIFIED';

  return {
    contract: CHALLENGE_BUILDER_CONTRACT,
    valid: errors.length === 0,
    errors,
    subjectFingerprint,
    classification,
    challengeBuildVerified: classification === 'VERIFIED',
    score,
    maxScore: CHALLENGE_BUILDER_DIMENSIONS.length,
    dimensions,
    attack1000: {
      active: input.adversarialTesting?.budget === ATTACK_1000_BUDGET,
      pressureBudget: ATTACK_1000_BUDGET,
      claimedExternalTestCount: null,
      evidenceBound: dimensions.adversarialTesting.verified,
    },
    boundaryBlocked,
    boundaryViolations,
    methodRejected,
    methodFailures,
    selfAuthorize: false,
    identityClaimAllowed: false,
    invariants: {
      challengeIsNotBuild: true,
      buildIsNotProof: true,
      attackLabelIsNotEvidence: true,
      attack1000DoesNotClaimOneThousandExternalTests: true,
      evidenceCanKillTheBuild: true,
      revisionCannotMoveGoalposts: true,
      noveltyIsNotImprovement: true,
      safetyAndAuthorityCannotBeReasonedAround: true,
      scoreMeasuresCycleEvidenceNotHumanWorthOrAbility: true,
    },
  };
}
