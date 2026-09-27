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
  'Chat is the invention lab. Founder Control Room is the durable workflow product layer.',
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
  if (councilContract.contract !== 'juss/founder-council-residency@v1') failures.push('Council machine contract: wrong contract id');
  if (councilContract.project !== 'jussray/chief-ai-machine') failures.push('Council machine contract: wrong project');

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
console.log('Chief routing, Council jurisdiction, protected intelligence, provider boundaries, FCR WorkflowCandidate handoff, and proven-only task clearance are aligned in source.');
console.log('Live completion still requires deployment identity, runtime-path proof, Playwright evidence, and a successor fingerprint.');
