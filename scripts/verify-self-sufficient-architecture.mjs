import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const KERNEL_URL = new URL('../.control-room/architecture-kernel.json', import.meta.url);
const CONTRACT = 'juss/self-sufficient-architecture@v1';
const REQUIRED_CORE = Object.freeze([
  'intent', 'north-star', 'truth', 'authority', 'state', 'continuity',
  'capability-routing', 'verification', 'proof', 'rollback', 'task-accuracy', 'outcome-learning',
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function architectureKernelFingerprint(kernel) {
  return createHash('sha256').update(canonicalJson(kernel)).digest('hex');
}

export function validateArchitectureKernel(kernel) {
  const errors = [];
  if (!kernel || typeof kernel !== 'object' || Array.isArray(kernel)) return ['architecture kernel must be an object'];
  if (kernel.contract !== CONTRACT) errors.push(`contract must be ${CONTRACT}`);
  if (typeof kernel.project !== 'string' || !kernel.project.trim()) errors.push('project is required');
  if (kernel.coreOwner !== 'project') errors.push('coreOwner must remain project');
  const capabilities = Array.isArray(kernel.coreCapabilities) ? kernel.coreCapabilities : [];
  const uniqueCapabilities = new Set(capabilities);
  if (uniqueCapabilities.size !== capabilities.length) errors.push('coreCapabilities must not contain duplicates');
  for (const capability of REQUIRED_CORE) if (!uniqueCapabilities.has(capability)) errors.push(`missing core capability: ${capability}`);
  const plugins = kernel.externalSystems;
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) errors.push('externalSystems policy is required');
  else {
    if (plugins.role !== 'plugin') errors.push('external systems must be plugins');
    if (plugins.requiredForCoreBoot !== false) errors.push('plugins must not be required for core boot');
    if (plugins.mayOwnCoreCapability !== false) errors.push('plugins must not own core capabilities');
    if (plugins.mayIncreaseAuthority !== false) errors.push('plugins must not increase authority');
    if (plugins.silentSubstitutionAllowed !== false) errors.push('silent plugin substitution must stay disabled');
    if (plugins.identityMustBeReceipted !== true) errors.push('plugin identity must be receipted');
    if (plugins.failurePolicy !== 'scoped-blocker') errors.push('plugin failure must remain a scoped blocker');
    if (plugins.selectionPolicy !== 'capability-fit') errors.push('plugins must be selected by capability fit');
    if (plugins.purpose !== 'extend-or-accelerate') errors.push('plugins may only extend or accelerate the core');
  }
  return errors;
}

export async function verifyArchitectureKernel() {
  const kernel = JSON.parse(await readFile(KERNEL_URL, 'utf8'));
  const errors = validateArchitectureKernel(kernel);
  if (errors.length) throw new Error(`Self-sufficient architecture invariant failed:\n- ${errors.join('\n- ')}`);
  return { project: kernel.project, fingerprint: architectureKernelFingerprint(kernel) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await verifyArchitectureKernel();
  console.log(`architecture-kernel ok project=${result.project} fingerprint=${result.fingerprint}`);
}
