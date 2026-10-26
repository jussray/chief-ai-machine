// Offline advisory-only preparation for Chief AI's native Executive Council.
// No imports from native council are duplicated here; no reviews or votes are forged.
// This module creates requests for real specialist review, not specialist reports.
import { planNvidiaSkillEvaluation } from './nvidia-skill-evaluation.mjs';

const DOMAINS = Object.freeze([
  Object.freeze({
    domain: 'engineering', role: 'Engineering Reviewer',
    question: 'Does the proposed capability fit existing code, and can it be evaluated without changing production routes?',
    requiredEvidence: Object.freeze(['exact Git head', 'dependency and compatibility inspection', 'focused tests']),
  }),
  Object.freeze({
    domain: 'security', role: 'Security Reviewer',
    question: 'Can imported instructions, prompts, and provider responses cross authorization or execution boundaries?',
    requiredEvidence: Object.freeze(['native authority contracts', 'hostile-input tests', 'secret and egress boundaries']),
  }),
  Object.freeze({
    domain: 'privacy', role: 'Privacy Reviewer',
    question: 'Can evaluation proceed with synthetic data and no unauthorized workspace, teen, or parent information?',
    requiredEvidence: Object.freeze(['data-flow map', 'consent and minimization review', 'isolation and revocation plan']),
  }),
  Object.freeze({
    domain: 'product-safety', role: 'Product Safety Reviewer',
    question: 'Will existing safeguards, character identity, and recovery behavior remain authoritative?',
    requiredEvidence: Object.freeze(['current safety contracts', 'negative-path tests', 'fallback preservation']),
  }),
  Object.freeze({
    domain: 'operations', role: 'Operations Reviewer',
    question: 'Are vendor availability, price, latency, outage behavior, proof and rollback independently established?',
    requiredEvidence: Object.freeze(['catalog/version snapshot', 'cost and timeout limits', 'deployment-specific rollback gate']),
  }),
]);

const NO_MATCH = Object.freeze({
  schema: 'juss/nvidia-council-review-request@v1',
  status: 'NO_MATCH',
  councilStatus: 'NOT_CONVENED',
  recommendation: 'HOLD',
  integrationState: 'ABSENT',
  executionAuthority: 'none',
  maySendPrivateData: false,
  providerEnabled: false,
  mayApprove: false,
});

function ownValue(value, key) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  } catch { return undefined; } // A hostile proxy cannot break the review planner.
}

export function prepareNvidiaCouncilReview(input) {
  const repository = ownValue(input, 'repository');
  const objective = ownValue(input, 'objective');
  if (typeof repository !== 'string' || typeof objective !== 'string') return NO_MATCH;
  let route;
  try { route = planNvidiaSkillEvaluation({ repository, objective }); }
  catch { return NO_MATCH; }
  if (route.status !== 'ADVISORY_ONLY') return NO_MATCH;

  const reviewRequests = Object.freeze(DOMAINS.map((entry) => Object.freeze({
    domain: entry.domain,
    role: entry.role,
    question: entry.question,
    requiredEvidence: entry.requiredEvidence,
    reportStatus: 'NOT_SUBMITTED',
    // Deliberately NO position, confidence, approval, or invented evidence.
    // These must come from individually validated native Specialist Reports.
  })));

  return Object.freeze({
    schema: 'juss/nvidia-council-review-request@v1',
    status: 'ADVISORY_ONLY',
    councilStatus: 'NOT_CONVENED',
    recommendation: 'HOLD',
    integrationState: 'ABSENT', // Offline planner placeholder, not a live provider inventory.
    repository,
    objective,
    executionAuthority: 'none',
    providerEnabled: false,
    maySendPrivateData: false,
    mayApprove: false,
    proposedProviderSkillNames: route.providerSkills,
    requiredNativeSkills: route.localSkills,
    specialistReviewRequests: reviewRequests,
    nativeCouncilContracts: Object.freeze({
      specialistModule: 'src/domain/specialist-report.js',
      councilModule: 'src/domain/executive-council.js',
      briefModule: 'src/domain/executive-brief.js',
      reportCreation: 'createSpecialistReport',
      reportValidation: 'validateSpecialistReport',
      synthesis: 'synthesizeExecutiveCouncil',
      synthesisValidation: 'validateExecutiveCouncilSynthesis',
      briefValidation: 'validateExecutiveBrief',
      proposedStatus: 'draft',
    }),
    outstandingEvidence: Object.freeze([
      'Current main head and exact candidate branch/head not recorded by this planner',
      'No independently submitted specialist reports or positions',
      'No Executive Council synthesis or Executive Brief validation performed',
      'No live provider, credential, runtime, billing, or production evidence',
      'No external-publication or merge approval',
    ]),
    requiredGates: Object.freeze([
      'Read founder-native and repository-native skill contracts before vendor guidance',
      'Request one independently reviewed specialist report per domain, with evidence refs and dissent',
      'Validate each report with the native schema; do not fabricate VERIFIED evidence',
      'Use the existing Executive Council synthesizer only after real reports exist',
      'Preserve conservative confidence caps, dissent, and blocked/unknown evidence',
      'Founder Control Room separately confirms execution authority and exact-head evidence',
      'Explicit scope approval before repository publication, provider traffic, merge or deployment',
    ]),
  });
}
