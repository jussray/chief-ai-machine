import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [
  contract,
  twinCore,
  pairContractText,
  handoff,
  missionPlan,
  missionPlanTest,
  agents,
  claude,
  chatgpt,
  perplexity,
  chiefSkill,
  council,
] = await Promise.all([
  read('docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md'),
  read('docs/TWIN_CORE_CONTROL_PLANE_CONTRACT.md'),
  read('config/founder-chief-pair.contract.json'),
  read('docs/FCR_WORKFLOW_GRADUATION_HANDOFF.md'),
  read('src/domain/founder-mission-plan.js'),
  read('src/domain/founder-mission-plan.test.js'),
  read('AGENTS.md'),
  read('CLAUDE.md'),
  read('CHATGPT.md'),
  read('PERPLEXITY.md'),
  read('.claude/skills/juss-chief-ai/SKILL.md'),
  read('.control-room/COUNCIL.md'),
]);

const pairContract = JSON.parse(pairContractText);
const failures = [];
const requireText = (label, source, expected) => {
  if (!source.includes(expected)) failures.push(`${label}: missing ${JSON.stringify(expected)}`);
};
const requireValue = (condition, message) => {
  if (!condition) failures.push(message);
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
  '# Twin Core Control Plane Contract',
  'main@eb7c0861ba6ab3ed772efc672aff307bad7539fa',
  '## Adopt mechanics, not identity',
  '5W1H mission contract',
  'mission-brief',
  'system-map',
  'red-team-register',
  'artifact-ledger',
  'bottleneck-map',
  'verification-report',
  'founder-decision-pack',
  'Append-only history',
  'Allowlisted execution',
  'UI render is not runtime proof',
  '## Twin Core anti-collapse invariant',
  'FCR must **not** become the capability selector',
  'Chief must **not** become the durable workflow registry',
  'FCR == Chief',
  'Chief == FCR',
  'commercial packaging == technical absorption',
  'Copy the control-plane mechanism. Re-express it in portfolio-neutral contracts.',
  'Chief creates/decomposes the mission envelope',
  'FCR validates, persists, executes through authorized paths, records evidence, and controls task clearance.',
  'FCR execution accepts only registered/allowlisted workflow or action IDs whose authority policy is known.',
  '## Provenance and supersession',
]) requireText('Twin Core donor contract', twinCore, marker);

requireValue(pairContract.relationship?.topology === 'standalone-peers', 'Twin Core topology must remain standalone-peers');
requireValue(pairContract.relationship?.controlRoom?.independentlyCallable === true, 'FCR must remain independently callable');
requireValue(pairContract.relationship?.chiefAI?.independentlyCallable === true, 'Chief must remain independently callable');
requireValue(pairContract.relationship?.controlRoom?.ownsIdentity === true, 'FCR must retain its own identity');
requireValue(pairContract.relationship?.chiefAI?.ownsIdentity === true, 'Chief must retain its own identity');
requireValue(pairContract.relationship?.controlRoom?.ownsLifecycle === true, 'FCR must retain its own lifecycle');
requireValue(pairContract.relationship?.chiefAI?.ownsLifecycle === true, 'Chief must retain its own lifecycle');
requireValue(pairContract.relationship?.controlRoom?.ownsReceipts === true, 'FCR must retain its own receipts');
requireValue(pairContract.relationship?.chiefAI?.ownsReceipts === true, 'Chief must retain its own receipts');
requireValue(pairContract.relationship?.controlRoom?.ownsFailureState === true, 'FCR must retain its own failure state');
requireValue(pairContract.relationship?.chiefAI?.ownsFailureState === true, 'Chief must retain its own failure state');
requireValue(pairContract.relationship?.crossSystem?.identityCollapseAllowed === false, 'FCR/Chief identity collapse must stay forbidden');
requireValue(pairContract.relationship?.crossSystem?.implicitAuthorityTransferAllowed === false, 'implicit authority transfer must stay forbidden');
requireValue(pairContract.relationship?.crossSystem?.receiptCollapseAllowed === false, 'receipt collapse must stay forbidden');
requireValue(pairContract.relationship?.crossSystem?.failureCollapseAllowed === false, 'failure collapse must stay forbidden');
requireValue(pairContract.relationship?.crossSystem?.continuityCollapseAllowed === false, 'continuity collapse must stay forbidden');
requireValue(pairContract.commercialPackaging?.technicalTopology === 'standalone-peers', 'commercial packaging must not rewrite technical topology');
requireValue(pairContract.commercialPackaging?.chiefTechnicalIndependence === true, 'Chief technical independence must remain true');
requireValue(pairContract.commercialPackaging?.chiefDefaultCommercialPackaging === 'inside-founder-control-room', 'Chief may be packaged inside FCR only as commercial/product packaging');
requireValue(pairContract.v10?.capabilitySelector === 'chief-ai-machine', 'Chief must remain capability selector');
requireValue(pairContract.v10?.governanceAuthority === 'founder-control-room', 'FCR must remain governance authority');

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
  "FOUNDER_MISSION_ENVELOPE_CONTRACT = 'juss/founder-mission-envelope@v1'",
  "FCR_WORKFLOW_CANDIDATE_CONTRACT = 'juss/fcr-workflow-candidate@v1'",
  'FOUNDER_MISSION_CORE_ARTIFACT_IDS',
  "'mission-brief'",
  "'verification-report'",
  "'founder-decision-pack'",
  "'mission-brief': 'chief-ai'",
  "'verification-report': 'founder-control-room'",
  'authorizesExecution: false',
  'authorizesClearance: false',
  'Chief cannot self-assert final proven/cleared task state',
  'createFounderMissionPlanSuccessor',
  'mission identity cannot change across append-only successors',
  'compileFcrWorkflowCandidate',
  'FCR clears only after required proof is proven',
  'isActionIdSyntaxValid',
  'does not claim registry membership',
  'FCR must validate the identifier against its',
]) requireText('Chief mission-plan source', missionPlan, marker);

for (const marker of [
  'creates the complete Bip-derived artifact spine while keeping role ownership distinct',
  'rejects any attempt by Chief to become final proof or task-clearance authority',
  'keeps append-only mission lineage and mission identity',
  'accepts only bounded action-ID syntax and leaves registry membership to FCR',
  'compiles an FCR workflow candidate without donating Chief identity or authority',
  "expect(isActionIdSyntaxValid('npm run test')).toBe(false)",
]) requireText('Chief mission-plan tests', missionPlanTest, marker);

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
  'Chief action-ID syntax validation proves registry membership',
]) {
  const all = [contract, twinCore, handoff, missionPlan, agents, claude, perplexity, chiefSkill, council].join('\n');
  if (all.includes(forbidden)) failures.push(`forbidden productization/anti-collapse claim: ${forbidden}`);
}

if (failures.length) {
  console.error('Chief work productization contract failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Chief work productization contract passed.');
console.log('Chief routing, Bip-derived Founder Operator planning mechanics, machine-enforced Twin Core anti-collapse, Claude, Perplexity, Council, provider boundaries, FCR WorkflowCandidate handoff, and proven-only task clearance are aligned in source.');
console.log('This verifier proves source contract alignment only; it does not prove FCR workflow runtime or user outcomes.');
