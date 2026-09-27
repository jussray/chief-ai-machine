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
] = await Promise.all([
  read('docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md'),
  read('docs/FCR_WORKFLOW_GRADUATION_HANDOFF.md'),
  read('AGENTS.md'),
  read('CLAUDE.md'),
  read('CHATGPT.md'),
  read('PERPLEXITY.md'),
  read('.claude/skills/juss-chief-ai/SKILL.md'),
  read('.control-room/COUNCIL.md'),
]);

const failures = [];
const requireText = (label, source, expected) => {
  if (!source.includes(expected)) failures.push(`${label}: missing ${JSON.stringify(expected)}`);
};

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
console.log('Chief routing, Claude, Perplexity, Council, provider boundaries, FCR WorkflowCandidate handoff, and proven-only task clearance are aligned in source.');
console.log('This verifier proves source contract alignment only; it does not prove FCR workflow runtime or user outcomes.');
