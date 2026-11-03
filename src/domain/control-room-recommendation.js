import { sha256Hex } from './capability-plan.js';

export const CONTROL_ROOM_RECOMMENDATION_CONTRACT = 'chief-ai/control-room-recommendation@v1';

export const CONTROL_ROOM_PROJECT_TYPES = Object.freeze([
  'product-app',
  'website',
  'ai-agent',
  'business-company',
  'client-project',
  'content-brand',
  'store-commerce',
  'research-decision',
  'other',
]);

export const CONTROL_ROOM_MISSIONS = Object.freeze([
  'build',
  'fix',
  'launch',
  'grow',
  'operate',
  'decide',
  'prove',
]);

export const CONTROL_ROOM_STATES = Object.freeze([
  'idea',
  'planning',
  'building',
  'live',
  'broken',
  'needs-improvement',
  'unsure',
]);

const PROJECT_TYPE_SET = new Set(CONTROL_ROOM_PROJECT_TYPES);
const MISSION_SET = new Set(CONTROL_ROOM_MISSIONS);
const STATE_SET = new Set(CONTROL_ROOM_STATES);

const PROJECT_LABELS = Object.freeze({
  'product-app': 'Product / App',
  website: 'Website',
  'ai-agent': 'AI / Agent System',
  'business-company': 'Business / Company',
  'client-project': 'Client Project',
  'content-brand': 'Content / Brand',
  'store-commerce': 'Store / Commerce',
  'research-decision': 'Research / Decision',
  other: 'Other',
});

const MISSION_LABELS = Object.freeze({
  build: 'Build',
  fix: 'Fix',
  launch: 'Launch',
  grow: 'Grow',
  operate: 'Operate',
  decide: 'Decide',
  prove: 'Prove',
});

const STATE_LABELS = Object.freeze({
  idea: 'Idea',
  planning: 'Planning',
  building: 'Building',
  live: 'Already live',
  broken: 'Broken',
  'needs-improvement': 'Needs improvement',
  unsure: 'Unsure',
});

const MISSION_PROFILES = Object.freeze({
  build: Object.freeze({
    focus: 'Turn founder intent into the smallest working slice that can be verified.',
    capabilityIntents: Object.freeze(['goal-planning', 'build-assist', 'verification']),
    evidencePriorities: Object.freeze(['definition of done', 'current source state', 'focused build proof']),
    nextGate: 'Define and verify the smallest working slice before expanding scope.',
  }),
  fix: Object.freeze({
    focus: 'Locate the real failing path, isolate one cause, repair it reversibly, and prove the path again.',
    capabilityIntents: Object.freeze(['repo-audit-first', 'goalfix', 'verification']),
    evidencePriorities: Object.freeze(['exact failure evidence', 'authoritative source state', 'focused regression proof']),
    nextGate: 'Capture the failing path and its exact evidence before mutation.',
  }),
  launch: Object.freeze({
    focus: 'Clear only launch-critical blockers and bind the release candidate to exact runtime evidence.',
    capabilityIntents: Object.freeze(['launch-readiness', 'proofmode', 'rollback-planning']),
    evidencePriorities: Object.freeze(['exact release identity', 'runtime/provider evidence', 'real-path acceptance proof']),
    nextGate: 'Prove the exact release candidate on the real runtime path before launch authority changes.',
  }),
  grow: Object.freeze({
    focus: 'Choose the nearest measurable growth signal, establish a baseline, and run one reversible growth loop.',
    capabilityIntents: Object.freeze(['growth-analysis', 'experiment-design', 'outcome-review']),
    evidencePriorities: Object.freeze(['current baseline', 'target audience or customer signal', 'measured outcome']),
    nextGate: 'Choose one measurable growth signal and record its current baseline.',
  }),
  operate: Object.freeze({
    focus: 'Keep the current system healthy by making state, failures, ownership, and recovery visible.',
    capabilityIntents: Object.freeze(['operational-health', 'incident-review', 'recovery-planning']),
    evidencePriorities: Object.freeze(['current health', 'failure signals', 'recovery or rollback path']),
    nextGate: 'Establish current health and the first actionable failure signal.',
  }),
  decide: Object.freeze({
    focus: 'Reduce the decision to the highest-impact unknowns, compare evidence, and preserve founder choice.',
    capabilityIntents: Object.freeze(['evidence-synthesis', 'decision-support', 'redteam']),
    evidencePriorities: Object.freeze(['decision criteria', 'credible evidence', 'material unknowns and reversibility']),
    nextGate: 'Resolve the highest-impact unknown that could change the decision.',
  }),
  prove: Object.freeze({
    focus: 'Bind one claim to a precise subject, current evidence, freshness rules, and a falsifiable result.',
    capabilityIntents: Object.freeze(['proofmode', 'evidence-review', 'truth-decay']),
    evidencePriorities: Object.freeze(['exact claim subject', 'authoritative proof source', 'freshness or expiry condition']),
    nextGate: 'Define the exact claim and the evidence that would prove or disprove it.',
  }),
});

const TYPE_EVIDENCE = Object.freeze({
  'product-app': Object.freeze(['user-flow behavior', 'application runtime identity']),
  website: Object.freeze(['rendered browser behavior', 'deployment identity']),
  'ai-agent': Object.freeze(['model/tool boundary behavior', 'authority and execution receipts']),
  'business-company': Object.freeze(['operating records', 'customer or revenue outcome evidence']),
  'client-project': Object.freeze(['accepted scope', 'client-visible delivery proof']),
  'content-brand': Object.freeze(['publication boundary', 'audience outcome evidence']),
  'store-commerce': Object.freeze(['catalog and checkout path', 'payment/order outcome evidence']),
  'research-decision': Object.freeze(['source quality', 'assumptions and conflicting evidence']),
  other: Object.freeze(['authoritative current state', 'goal-specific proof']),
});

const STATE_GUIDANCE = Object.freeze({
  idea: 'Treat the declared state as intent only; do not infer runtime or implementation evidence.',
  planning: 'Separate planned behavior from implemented behavior and preserve open assumptions.',
  building: 'Prefer exact source/build evidence and do not promote it into production truth.',
  live: 'Require current runtime/provider identity before treating source or build evidence as live truth.',
  broken: 'Preserve the failing receipt before repair and verify the same path after the fix.',
  'needs-improvement': 'Record the current baseline before changing the system so improvement can be measured.',
  unsure: 'Classify reality before selecting a mutation; unknown state must not be rounded up to healthy.',
});

function clean(value, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function seed(recommendation) {
  return JSON.stringify([
    recommendation.contract,
    recommendation.selectedBy,
    recommendation.project.name,
    recommendation.project.projectType,
    recommendation.project.mission,
    recommendation.project.currentState,
    recommendation.project.repoIdentifier,
    recommendation.project.stack,
    recommendation.focus,
    recommendation.capabilityIntents,
    recommendation.evidencePriorities,
    recommendation.stateGuidance,
    recommendation.nextGate,
    recommendation.boundaries,
  ]);
}

export function createControlRoomRecommendation(input = {}) {
  const projectType = clean(input.projectType, 80);
  const mission = clean(input.mission, 80);
  const currentState = clean(input.currentState, 80);
  const name = clean(input.projectName, 120);
  const repoIdentifier = clean(input.repoIdentifier, 240);
  const stack = clean(input.stack, 240);

  if (!name) throw new Error('Project name is required');
  if (!PROJECT_TYPE_SET.has(projectType)) throw new Error('Unsupported Control Room project type');
  if (!MISSION_SET.has(mission)) throw new Error('Unsupported Control Room mission');
  if (!STATE_SET.has(currentState)) throw new Error('Unsupported Control Room current state');

  const profile = MISSION_PROFILES[mission];
  const boundaries = Object.freeze([
    'Recommendation only; Chief does not create or mutate Founder Control Room state.',
    'Founder-declared current state is context, not independently verified reality.',
    'Chief does not grant merge, deployment, migration, provider, spend, publication, or credential authority.',
    'Founder Control Room must independently resolve evidence, authority, and any execution handoff.',
  ]);

  const recommendation = {
    contract: CONTROL_ROOM_RECOMMENDATION_CONTRACT,
    selectedBy: 'chief-ai-machine',
    project: Object.freeze({
      name,
      projectType,
      projectTypeLabel: PROJECT_LABELS[projectType],
      mission,
      missionLabel: MISSION_LABELS[mission],
      currentState,
      currentStateLabel: STATE_LABELS[currentState],
      repoIdentifier: repoIdentifier || null,
      stack: stack || null,
    }),
    title: `Chief recommends a ${PROJECT_LABELS[projectType]} Control Room focused on ${MISSION_LABELS[mission]}.`,
    focus: profile.focus,
    capabilityIntents: Object.freeze([...profile.capabilityIntents]),
    evidencePriorities: Object.freeze(unique([
      ...profile.evidencePriorities,
      ...TYPE_EVIDENCE[projectType],
    ])),
    stateGuidance: STATE_GUIDANCE[currentState],
    nextGate: profile.nextGate,
    confidence: 'bounded-rule-match',
    founderDecision: Object.freeze({
      required: true,
      explicitDecisionOnly: true,
      accepted: false,
      createControlRoomAuthorized: false,
    }),
    fcrHandoff: Object.freeze({
      stateAuthority: 'founder-control-room',
      evidenceAuthority: 'founder-control-room',
      executionAuthority: 'unresolved-by-chief-ai',
      preserveFounderDeclaredState: true,
      verifyRealityIndependently: true,
    }),
    boundaries,
  };

  return Object.freeze({
    ...recommendation,
    recommendationHash: sha256Hex(seed(recommendation)),
  });
}
