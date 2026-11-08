export const PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT = 'promptos/public-command-intent@v1';
export const PROMPTOS_CHIEF_FCR_COMMAND_HANDOFF_CONTRACT = 'juss/promptos-chief-fcr-command-handoff@v1';

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function identifier(value, label) {
  if (typeof value !== 'string' || value.length > 128
    || !/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

/**
 * Convert caller-provided PromptOS command metadata into a data-only handoff.
 * This does not resolve a workspace, execute a tool, approve a request or
 * grant FCR authority. Sensitive free-form arguments never enter the receipt.
 */
export function createPromptOSChiefCommandHandoff(intent, options = {}) {
  if (!record(intent) || intent.schema !== PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT) {
    throw new Error('Invalid PromptOS public command contract');
  }
  if (!record(intent.command) || typeof intent.command.token !== 'string'
    || !/^\/[a-z][a-z0-9_-]{0,63}$/i.test(intent.command.token)) {
    throw new Error('Invalid PromptOS command identity');
  }

  const project = identifier(intent.project, 'project');
  const capabilityId = identifier(intent.capabilityId, 'capability');
  const commandId = identifier(intent.command.id, 'command');
  if (options.resolvedProject !== undefined
    && identifier(options.resolvedProject, 'resolved project') !== project) {
    throw new Error('PromptOS project scope mismatch');
  }
  if (!record(intent.route)
    || intent.route.owner !== 'promptos'
    || intent.route.reasoningPlane !== 'chief-ai-machine'
    || intent.route.authorityPlane !== 'founder-control-room'
    || identifier(intent.route.specialistProduct, 'specialist product') !== project) {
    throw new Error('PromptOS route authority mismatch');
  }
  if (intent.authorityCeiling !== 'advisory-only'
    || !record(intent.execution)
    || intent.execution.status !== 'not-executed'
    || intent.execution.mutationAuthorized !== false
    || !record(intent.evidence)
    || intent.evidence.staleOnStateChange !== true
    || intent.evidence.contract !== 'current-authority') {
    throw new Error('PromptOS command must remain advisory-only and unexecuted');
  }

  return Object.freeze({
    schema: PROMPTOS_CHIEF_FCR_COMMAND_HANDOFF_CONTRACT,
    intentContract: PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT,
    acceptedBy: 'chief-ai-machine',
    commandId,
    project,
    capabilityId,
    specialistProduct: project,
    authorityPlane: 'founder-control-room',
    authorityResolution: 'unresolved',
    actionAuthority: false,
    executionAuthorized: false,
    nextRequiredContract: 'juss-v10/capability-plan@v1',
  });
}
