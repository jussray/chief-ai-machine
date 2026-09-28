import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [
  contract,
  handoff,
  agents,
  claude,
  chatgpt,
  perplexity,
  chiefSkill,
  council,
  councilContractRaw,
] = await Promise.all([
  read('docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md'),
  read('docs/FCR_WORKFLOW_GRADUATION_HANDOFF.md'),
  read('AGENTS.md'),
  read('CLAUDE.md'),
  read('CHATGPT.md'),
  read('PERPLEXITY.md'),
  read('.claude/skills/juss-chief-ai/SKILL.md'),
  read('.control-room/COUNCIL.md'),
  read('.control-room/council-residency.contract.json'),
]);

const failures = [];
const requireText = (label, source, expected) => {
  if (!source.includes(expected)) failures.push(`${label}: missing ${JSON.stringify(expected)}`);
};
const requireTrue = (label, value) => {
  if (value !== true) failures.push(`${label}: expected true`);
};
const requireFalse = (label, value) => {
  if (value !== false) failures.push(`${label}: expected false`);
};
const requireIncludes = (label, values, expected) => {
  if (!Array.isArray(values) || !values.includes(expected)) failures.push(`${label}: missing ${JSON.stringify(expected)}`);
};

let councilContract;
try {
  councilContract = JSON.parse(councilContractRaw);
} catch (error) {
  failures.push(`Council machine contract: invalid JSON (${error.message})`);
}

for (const marker of [
  'Founder Control Room is a standalone founder operating/build intelligence',
  '## WorkflowCandidate contract',
  'required_proof_stage',
  'OpenAI API key != GitHub authority',
  'Anthropic API key != Supabase authority',
  '## Council productization rule',
  '## Court productization rule',
  '## Instruction inheritance',
  '## Task clearance invariant',
  'A task clears only when the proof required by the original goal is satisfied by current evidence.',
  'OPEN | ACTIVE | BLOCKED | PROOF_PENDING | PROVEN | CLEARED',
  '`PROVEN` is an evidence predicate. `CLEARED` is the task-state transition',
  'Earlier stages never silently satisfy a later-stage goal.',
  'For assistant behavior, words such as `done`, `complete`, `fixed`, `cleared`, `live`, or `working` are proof claims',
]) requireText('shared contract', contract, marker);

for (const marker of [
  'Chief AI is the workflow-candidate compiler.',
  'juss/fcr-workflow-candidate@v1',
  '## Detection rule',
  '## Compile before handoff',
  'required_proof_stage',
  'task_clearance_rule',
  '## Task clearance',
  'OPEN | ACTIVE | BLOCKED | PROOF_PENDING | PROVEN | CLEARED',
  'When evidence is partial, Chief reports the achieved proof stage plus `remaining_gate`; it must not recommend `CLEARED`.',
  'Workflow disposition and task clearance are separate.',
  '## Council',
  '## Court',
  '## Provider routing',
  '## Handoff outcome',
]) requireText('Chief handoff', handoff, marker);

for (const marker of [
  'docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md',
  'docs/FCR_WORKFLOW_GRADUATION_HANDOFF.md',
  '## Work productization',
  'juss/fcr-workflow-candidate@v1',
  'Leaf skills inherit',
]) requireText('AGENTS productization', agents, marker);

for (const marker of [
  'docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md',
  'docs/FCR_WORKFLOW_GRADUATION_HANDOFF.md',
  '## Work productization',
  'Chief compiles juss/fcr-workflow-candidate@v1',
  'Chat/Cowork is an invention and implementation surface',
]) requireText('Claude productization', claude, marker);

requireText('ChatGPT parent AGENTS', chatgpt, 'AGENTS.md');
requireText('ChatGPT parent Claude', chatgpt, 'CLAUDE.md');

for (const marker of [
  'docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md',
  'docs/FCR_WORKFLOW_GRADUATION_HANDOFF.md',
  'Perplexity may improve a `juss/fcr-workflow-candidate@v1` packet',
  'An OpenAI API key is not GitHub authority.',
  'An Anthropic API key is not Supabase authority.',
  '## Council and Court',
]) requireText('Perplexity productization', perplexity, marker);

for (const marker of [
  'docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md',
  'docs/FCR_WORKFLOW_GRADUATION_HANDOFF.md',
  '## Workflow graduation',
  'juss/fcr-workflow-candidate@v1',
  'FCR/founder policy owns the durable state transition',
  'ONE-OFF',
  'WORKFLOW CANDIDATE',
]) requireText('Chief skill productization', chiefSkill, marker);

for (const marker of [
  'docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md',
  'docs/FCR_WORKFLOW_GRADUATION_HANDOFF.md',
  'workflow-candidate compilation',
  'An OpenAI or Anthropic key',
  '## Workflow graduation',
  'StoryEngine creative work',
]) requireText('Council productization', council, marker);

if (councilContract) {
  if (councilContract.contract !== 'juss/founder-council-federation@v2') failures.push('Council machine contract: wrong contract id');
  if (councilContract.project !== 'jussray/chief-ai-machine') failures.push('Council machine contract: wrong project');
  if (councilContract.projectRole !== 'executive_synthesis_reasoning_intelligence') failures.push('Council machine contract: wrong Chief role');

  const shared = councilContract.topology?.sharedCouncilLayer;
  requireTrue('Shared Council layer is neutral', shared?.neutral);
  requireFalse('Shared Council layer is not owned by a core system', shared?.ownedByCoreSystem);
  requireFalse('Shared Council layer is not owned by an external provider', shared?.ownedByExternalProvider);
  requireTrue('Shared Council survives provider replacement', shared?.mustRemainAvailableAcrossExternalProviderReplacement);
  requireTrue('Shared Council is not required for peer core operation', shared?.mustNotBecomeCoreDependencyForPeerOperation);
  if (shared?.physicalBacking !== 'UNDECIDED_UNTIL_SEPARATELY_AUTHORIZED') failures.push('Shared Council physical backing was pre-selected without authority');

  const requiredPeers = new Map([
    ['jussray/founder-control-room', 'founder_operating_build_intelligence'],
    ['jussray/chief-ai-machine', 'executive_synthesis_reasoning_intelligence'],
    ['jussray/solcontinuity', 'challenge_evaluation_continuity_intelligence'],
    ['jussray/promptos', 'prompt_workflow_compiler_routing_intelligence'],
  ]);
  const peers = Array.isArray(councilContract.topology?.coreSystems) ? councilContract.topology.coreSystems : [];
  for (const [repository, role] of requiredPeers) {
    const peer = peers.find((entry) => entry?.repository === repository);
    if (!peer) {
      failures.push(`Council machine contract: missing core peer ${repository}`);
      continue;
    }
    requireTrue(`${repository} standalone`, peer.standalone);
    requireTrue(`${repository} peer`, peer.peer);
    requireTrue(`${repository} survives Council unavailability`, peer.coreFunctionSurvivesCouncilUnavailable);
    if (peer.role !== role) failures.push(`${repository}: wrong role ${String(peer.role)}`);
  }

  const fcr = peers.find((entry) => entry?.repository === 'jussray/founder-control-room');
  requireText('FCR core capability', String(fcr?.description ?? ''), 'planning, inspecting, building, repairing, verifying, operating, and advancing the portfolio');

  const external = councilContract.topology?.externalProviderSeats;
  requireTrue('External providers are replaceable seats', external?.replaceable);
  requireFalse('External providers are not core dependencies', external?.coreDependency);
  requireTrue('External providers may be invoked from FCR', external?.mayBeInvokedFromFCR);
  requireTrue('Provider loss cannot erase portfolio state', external?.providerLossMustNotErasePortfolioState);
  requireTrue('Local adapter required', councilContract.topology?.localProjectAdapter?.required);
  if (councilContract.topology?.localProjectAdapter?.path !== '.control-room') failures.push('Council local adapter path drifted');
  requireFalse('Council does not centralize execution authority', councilContract.topology?.centralizedExecutionAuthority);
  requireFalse('Shared Council layer grants no execution authority', councilContract.authority?.sharedCouncilLayerGrantsExecutionAuthority);

  requireTrue('Council jurisdiction same kernel', councilContract.jurisdiction?.sameCourtCouncilKernel);
  requireTrue('Council jurisdiction repo/product/production scoped', councilContract.jurisdiction?.repoProductProductionScoped);
  for (const subject of [
    'intent_compression',
    'agent_and_model_routing',
    'delegation',
    'executive_synthesis',
    'decision_quality',
    'authority',
    'mcp_and_tool_behavior',
    'workflow_candidate_compilation',
    'provider_disagreement',
    'production_proof',
  ]) requireIncludes('Chief Council subjects', councilContract.jurisdiction?.subjects, subject);

  if (councilContract.intelligenceBoundary?.principle !== 'learn_encode_verify_compound_expose_value_protect_machinery') {
    failures.push('Council intelligence boundary: wrong principle');
  }
  requireTrue('Reusable intelligence becomes durable capability', councilContract.intelligenceBoundary?.reusableIntelligenceMustBecomeDurableCapability);
  requireTrue('Intelligence must not depend on founder memory', councilContract.intelligenceBoundary?.intelligenceMustNotDependOnFounderMemory);
  requireTrue('Users own data and outputs', councilContract.intelligenceBoundary?.usersOwnTheirDataAndOutputs);
  requireTrue('External providers stay replaceable', councilContract.intelligenceBoundary?.externalProvidersReplaceable);
  for (const form of ['code', 'internal_modules', 'policies', 'evaluators', 'workflow_engines', 'tests', 'receipts']) {
    requireIncludes('Durable intelligence forms', councilContract.intelligenceBoundary?.durableForms, form);
  }
  for (const protectedItem of ['internal_orchestration', 'hidden_prompts', 'private_reasoning', 'evaluator_notes', 'private_learning_records', 'proprietary_lineage']) {
    requireIncludes('Protected internal intelligence', councilContract.intelligenceBoundary?.internalOnly, protectedItem);
  }

  requireTrue('Affected live projects require end-to-end runtime proof', councilContract.completion?.affectedLiveProjectsRequireEndToEndRuntimeProof);
  requireTrue('Done words require live verification', councilContract.completion?.doneWordsRequireRuntimeVerificationWhenLiveGoal);
  requireTrue('Earlier stages do not satisfy live', councilContract.completion?.earlierStagesDoNotSatisfyLive);
  for (const proof of ['source_head', 'deployment_identity', 'runtime_path', 'playwright_evidence', 'successor_fingerprint']) {
    requireIncludes('Required live proof', councilContract.completion?.requiredLiveProof, proof);
  }
}

for (const forbidden of [
  'Council consensus authorizes mutation',
  'OpenAI API key grants GitHub authority',
  'Anthropic API key grants Supabase authority',
  'Claude activates durable execution authority',
  'a PR exists, therefore the task is complete',
]) {
  const all = [contract, handoff, agents, claude, perplexity, chiefSkill, council].join('\n');
  if (all.includes(forbidden)) failures.push(`forbidden productization authority/clearance claim: ${forbidden}`);
}

if (failures.length) {
  console.error('Chief work productization contract failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Chief work productization contract passed.');
console.log('Chief routing, neutral Council topology, standalone core peers, protected intelligence, provider boundaries, FCR WorkflowCandidate handoff, and proven-only task clearance are aligned in source.');
console.log('Live completion still requires deployment identity, runtime-path proof, Playwright evidence, and a successor fingerprint.');
