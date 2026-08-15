const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);
const AUTHORITY_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

const UI_PATTERN = /\b(ui|ux|screen|flow|interface|frontend|design|responsive|mobile|desktop|visual|accessib|playwright)\b/i;
const ANALYTICS_PATTERN = /\b(metric|analytics|data|funnel|conversion|retention|cohort|kpi|measure|instrument|telemetry|baseline)\b/i;
const PROVIDER_PATTERN = /\b(github|cloudflare|supabase|shopify|hubspot|gmail|slack|figma|canva|provider|dns|worker|pages|database|deployment)\b/i;
const PRODUCTION_PATTERN = /\b(production|deploy|deployment|migrate|migration|dns|domain|publish|send|spend|charge|refund|provider change|rollback)\b/i;
const INTEGRATION_PATTERN = /\b(merge|integrate|integration|land|main\b|release)\b/i;
const ARCHITECTURE_PATTERN = /\b(architecture|platform|operating system|control plane|runtime|broker|protocol|compiler|framework|system design)\b/i;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanString).filter(Boolean))];
}

function unique(values) {
  return [...new Set(values)];
}

function explicitRisk(value) {
  const normalized = cleanString(value).toLowerCase();
  return RISK_LEVELS.has(normalized) ? normalized : null;
}

function inferredRisk({ production, integration, providers }) {
  if (production) return 'critical';
  if (integration || providers) return 'high';
  return 'medium';
}

function authorityCeiling({ production, integration }) {
  if (production) return 'L6';
  if (integration) return 'L5';
  return 'L4';
}

function protocolStack({ risk, ui, analytics, architecture }) {
  const protocols = ['goalfix-v1', 'truthmode', 'confess', 'ooda', 'l99'];
  if (risk === 'medium' || risk === 'high' || risk === 'critical') protocols.push('redteam');
  if (architecture) protocols.push('lindymode');
  if (ui) protocols.push('product-design');
  if (analytics) protocols.push('data-analytics');
  return unique(protocols);
}

function evidenceRequirements({ ui, analytics, providers, production }) {
  const evidence = ['authoritative-source', 'exact-head'];
  if (ui) evidence.push('playwright');
  if (analytics) evidence.push('metric-baseline', 'post-change-metric');
  if (providers) evidence.push('provider-readback');
  if (production) evidence.push('rollback-path', 'production-readback');
  return unique(evidence);
}

function stopConditions({ authority, providers, production }) {
  const conditions = [
    'Stop when the requested outcome is proven at the authoritative source of truth.',
    'Stop and classify UNKNOWN when a decisive fact cannot be verified.',
    'Stop before widening scope beyond the stated project and objective.',
    'Stop on failing exact-head tests or contradictory evidence.',
  ];

  if (AUTHORITY_LEVELS.indexOf(authority) >= AUTHORITY_LEVELS.indexOf('L5')) {
    conditions.push('Stop before integration when exact-head proof or standing founder policy is missing.');
  }
  if (providers) {
    conditions.push('Stop before provider mutation when the project-scoped connection or required capability is missing.');
  }
  if (production) {
    conditions.push('Stop before production mutation when rollback or post-change read-back is unavailable.');
  }
  conditions.push('The system may exercise granted authority but may never expand its own authority.');
  return conditions;
}

function compiledPrompt({ intent, project, constraints, providers, risk, authority, protocols, evidence, stops }) {
  const lines = [
    'FOUNDER OS MISSION v1',
    `Founder intent: ${intent}`,
    `Project: ${project || 'UNRESOLVED_PROJECT'}`,
    `Risk: ${risk}`,
    `Authority ceiling: ${authority}`,
    `Protocol stack: ${protocols.join(' + ')}`,
    `Required proof: ${evidence.join(', ')}`,
    providers.length ? `Provider hints: ${providers.join(', ')}` : 'Provider hints: none supplied',
    constraints.length ? `Constraints: ${constraints.join(' | ')}` : 'Constraints: preserve unrelated working behavior; do not expose secrets.',
    '',
    'Chief AI responsibilities:',
    '1. Restate the founder goal and resolve the authoritative project before delegating work.',
    '2. Decompose the goal into the smallest coherent mission plan that can actually change reality.',
    '3. Use PromptOS protocols to produce explicit acceptance criteria, proof requirements, and stop conditions.',
    '4. Re-evaluate after every verified result and continue only while the founder goal remains unsatisfied.',
    '',
    'FCR responsibilities:',
    '1. Audit the real source of truth first, including exact current main for repository work.',
    '2. Resolve project-scoped authority and credentials by reference only; never expose credential values.',
    '3. Prefer reversible actions and preserve unrelated work.',
    '4. Bind code/runtime proof to the exact head. UI/runtime claims require Playwright.',
    '5. Record provider read-back, evidence receipts, failures, and rollback state.',
    '6. Never claim success from a queued, attempted, or unverified action.',
    '',
    'Stop conditions:',
    ...stops.map((item) => `- ${item}`),
    '',
    'Return a mission envelope with: GOAL, REALITY, PLAN, AUTHORITY, PROOF, METRICS, STOP CONDITION, NEXT STATE.',
  ];
  return lines.join('\n');
}

/**
 * Compile founder intent into a deterministic, provider-independent mission envelope.
 * This function plans and constrains work. It never performs external mutations.
 */
export function compileFounderMission(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('compileFounderMission input must be an object');
  }

  const intent = cleanString(input.intent ?? input.goal);
  if (!intent) throw new Error('Founder intent is required');

  const project = cleanString(input.project);
  const constraints = cleanList(input.constraints);
  const providers = cleanList(input.providers ?? input.providerHints);
  const haystack = [intent, project, ...constraints, ...providers].join(' ');

  const ui = UI_PATTERN.test(haystack);
  const analytics = ANALYTICS_PATTERN.test(haystack);
  const providerWork = providers.length > 0 || PROVIDER_PATTERN.test(haystack);
  const production = PRODUCTION_PATTERN.test(haystack);
  const integration = production || INTEGRATION_PATTERN.test(haystack);
  const architecture = ARCHITECTURE_PATTERN.test(haystack);
  const authority = authorityCeiling({ production, integration });
  const risk = explicitRisk(input.risk) ?? inferredRisk({ production, integration, providers: providerWork });
  const protocols = protocolStack({ risk, ui, analytics, architecture });
  const evidence = evidenceRequirements({ ui, analytics, providers: providerWork, production });
  const stops = stopConditions({ authority, providers: providerWork, production });

  return Object.freeze({
    version: 'founder-os-mission-v1',
    intent,
    project: project || null,
    projectResolution: project ? 'resolved-by-input' : 'required-before-execution',
    risk,
    authorityCeiling: authority,
    protocols,
    requiredEvidence: evidence,
    stopConditions: stops,
    executionContract: Object.freeze({
      chiefAI: 'reason, prioritize, decompose, delegate, and evaluate the goal',
      promptOS: 'compile protocols, acceptance criteria, proof requirements, and stop conditions',
      fcr: 'resolve authority, execute through project adapters, verify, receipt, and rollback',
      authorityRule: 'autonomous to founder standing policy; never self-expand authority',
    }),
    analytics: Object.freeze({
      proofCoverageTargetPercent: 100,
      requiresBaseline: analytics,
      requiresPostChangeMeasure: analytics,
      decisionMetric: 'goal-state verified, not task-count completed',
    }),
    compiledPrompt: compiledPrompt({
      intent,
      project,
      constraints,
      providers,
      risk,
      authority,
      protocols,
      evidence,
      stops,
    }),
  });
}
