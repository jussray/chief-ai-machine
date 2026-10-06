import { sha256Hex } from './capability-plan.js';

export const PROMPTOS_PEER_INTEGRATION_CONTRACT = 'juss/promptos-peer-integration@v1';
export const PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT = 'promptos/public-command-intent@v1';
export const PROMPTOS_CHIEF_FCR_COMMAND_HANDOFF_CONTRACT = 'juss/promptos-chief-fcr-command-handoff@v1';
export const PROMPTOS_COMMAND_NEXT_CONTRACT = 'juss-v10/capability-plan@v1';

export const PROMPTOS_PRODUCT = Object.freeze({
  product: 'PromptOS',
  repository: 'jussray/promptos',
  role: 'human-ai-operating-layer',
  portability: 'host-neutral',
  authority: 'advisory-only',
});

const SYSTEM_OWNED_MODE_NAMES = new Set([
  'goalfix', 'ultrathink', 'truthmode', 'confess', 'redteam', 'redteam2',
  'attackten', 'attack10', 'lindymode', 'ooda', 'proofmode', 'l99',
]);

const TOP_LEVEL_KEYS = new Set([
  'schema', 'command', 'arguments', 'project', 'capabilityId', 'route',
  'authorityCeiling', 'execution', 'evidence', 'catalogQuery',
]);
const COMMAND_KEYS = new Set(['id', 'token', 'category', 'label']);
const ROUTE_KEYS = new Set(['owner', 'reasoningPlane', 'specialistProduct', 'authorityPlane']);
const EXECUTION_KEYS = new Set(['status', 'mutationAuthorized']);
const EVIDENCE_KEYS = new Set(['contract', 'staleOnStateChange']);
const SAFE_TOKEN = /^[a-z0-9][a-z0-9-]{0,79}$/;

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function unknownKeys(value, allowed, path) {
  const raw = record(value);
  if (!raw) return [];
  return Object.keys(raw)
    .filter((key) => !allowed.has(key))
    .sort()
    .map((key) => `unknown ${path} field: ${key}`);
}

function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non_finite_number');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  throw new Error('unsupported_value');
}

function fingerprint(value) {
  return sha256Hex(JSON.stringify(canonicalize(value)));
}

function normalizePublicCommandIntent(value) {
  const raw = record(value);
  const command = record(raw?.command) ?? {};
  const route = record(raw?.route) ?? {};
  const execution = record(raw?.execution) ?? {};
  const evidence = record(raw?.evidence) ?? {};

  return {
    schema: clean(raw?.schema, 120),
    command: {
      id: clean(command.id, 80).toLowerCase(),
      token: clean(command.token, 100),
      category: clean(command.category, 80),
      label: clean(command.label, 160),
    },
    arguments: clean(raw?.arguments, 4_000),
    project: raw?.project === null ? null : clean(raw?.project, 240) || null,
    capabilityId: clean(raw?.capabilityId, 120).toLowerCase(),
    route: {
      owner: clean(route.owner, 80),
      reasoningPlane: clean(route.reasoningPlane, 120),
      specialistProduct: clean(route.specialistProduct, 160),
      authorityPlane: clean(route.authorityPlane, 120),
    },
    authorityCeiling: clean(raw?.authorityCeiling, 80),
    execution: {
      status: clean(execution.status, 80),
      mutationAuthorized: execution.mutationAuthorized === true,
    },
    evidence: {
      contract: clean(evidence.contract, 160),
      staleOnStateChange: evidence.staleOnStateChange === true,
    },
    catalogQuery: clean(raw?.catalogQuery, 240),
  };
}

export function validatePromptOSPublicCommandIntent(value) {
  const errors = [];
  const raw = record(value);
  if (!raw) return { valid: false, errors: ['PromptOS public command intent must be an object'], normalized: null };

  errors.push(...unknownKeys(raw, TOP_LEVEL_KEYS, 'intent'));
  errors.push(...unknownKeys(raw.command, COMMAND_KEYS, 'command'));
  errors.push(...unknownKeys(raw.route, ROUTE_KEYS, 'route'));
  errors.push(...unknownKeys(raw.execution, EXECUTION_KEYS, 'execution'));
  errors.push(...unknownKeys(raw.evidence, EVIDENCE_KEYS, 'evidence'));

  const normalized = normalizePublicCommandIntent(raw);
  if (normalized.schema !== PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT) errors.push('unsupported PromptOS public command intent contract');
  if (!SAFE_TOKEN.test(normalized.command.id)) errors.push('public command id is invalid');
  if (normalized.command.token !== `/${normalized.command.id}`) errors.push('public command token must bind the command id');
  if (!normalized.command.category) errors.push('public command category is required');
  if (!normalized.command.label) errors.push('public command label is required');
  if (!SAFE_TOKEN.test(normalized.capabilityId)) errors.push('public command capabilityId is invalid');
  if (!normalized.route.specialistProduct) errors.push('specialist product is required');
  if (normalized.route.owner !== 'promptos') errors.push('PromptOS must remain the public command owner');
  if (normalized.route.reasoningPlane !== 'chief-ai-machine') errors.push('Chief AI must remain the reasoning plane');
  if (normalized.route.authorityPlane !== 'founder-control-room') errors.push('Founder Control Room must remain the authority plane');
  if (normalized.authorityCeiling !== 'advisory-only') errors.push('PromptOS command authority ceiling must remain advisory-only');
  if (normalized.execution.status !== 'not-executed') errors.push('PromptOS command intent cannot claim execution');
  if (normalized.execution.mutationAuthorized !== false) errors.push('PromptOS command intent cannot authorize mutation');
  if (normalized.evidence.staleOnStateChange !== true) errors.push('PromptOS command evidence must invalidate on state change');
  if (!normalized.evidence.contract) errors.push('PromptOS command evidence contract is required');
  if (SYSTEM_OWNED_MODE_NAMES.has(normalized.command.id)) errors.push('system-owned control modes are not valid public command ids');
  if (SYSTEM_OWNED_MODE_NAMES.has(normalized.capabilityId)) errors.push('system-owned control modes are not valid public capability ids');

  return { valid: errors.length === 0, errors: [...new Set(errors)], normalized };
}

export function promptOSPublicCommandIntentFingerprint(value) {
  const validation = validatePromptOSPublicCommandIntent(value);
  if (!validation.valid || !validation.normalized) {
    throw new Error(validation.errors.join('; '));
  }
  return fingerprint(validation.normalized);
}

export function createPromptOSChiefCommandHandoff(value, context = {}) {
  const validation = validatePromptOSPublicCommandIntent(value);
  if (!validation.valid || !validation.normalized) {
    throw new Error(validation.errors.join('; '));
  }

  const sourceIntent = validation.normalized;
  const resolvedProject = sourceIntent.project || clean(context.resolvedProject, 240);
  if (!resolvedProject) {
    throw new Error('project context is required before Chief can hand a public command to Founder Control Room');
  }

  const payload = {
    contract: PROMPTOS_CHIEF_FCR_COMMAND_HANDOFF_CONTRACT,
    sourceIntentContract: PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT,
    sourceIntentFingerprint: fingerprint(sourceIntent),
    sourceIntent: Object.freeze({
      ...sourceIntent,
      command: Object.freeze({ ...sourceIntent.command }),
      route: Object.freeze({ ...sourceIntent.route }),
      execution: Object.freeze({ ...sourceIntent.execution }),
      evidence: Object.freeze({ ...sourceIntent.evidence }),
    }),
    acceptedBy: 'chief-ai-machine',
    status: 'accepted-for-capability-planning',
    project: resolvedProject,
    projectSource: sourceIntent.project ? 'promptos-hint' : 'chief-context',
    capabilityId: sourceIntent.capabilityId,
    specialistProduct: sourceIntent.route.specialistProduct,
    requestedOutcome: sourceIntent.arguments || sourceIntent.command.label,
    authorityPlane: 'founder-control-room',
    authorityResolution: 'unresolved',
    actionAuthority: false,
    executionAuthorized: false,
    nextRequiredContract: PROMPTOS_COMMAND_NEXT_CONTRACT,
  };

  return Object.freeze({
    ...payload,
    handoffFingerprint: fingerprint(payload),
  });
}

export function createPromptOSPeerIntegration(input = {}) {
  const consumer = clean(input.consumer, 160);
  if (!consumer) throw new Error('PromptOS peer integration requires a consumer identity');

  return Object.freeze({
    contract: PROMPTOS_PEER_INTEGRATION_CONTRACT,
    ...PROMPTOS_PRODUCT,
    relationship: 'peer-integration',
    ownership: 'independent-product',
    consumer,
    targetProject: clean(input.targetProject, 200),
  });
}
