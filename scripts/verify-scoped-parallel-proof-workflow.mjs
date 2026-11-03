import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const MAX_FILES = 15000;
const SKILL_ROOTS = [
  '.ai/skills', '.ai-skills/skills', '.ai-skills/gpts',
  '.agents/skills', '.claude/skills', 'systems/skills', 'skills',
];
const TEST_ROOTS = ['src', 'test', 'tests', 'e2e'];
const ATTACK_TEST_NAME = /(?:attack|adversarial|redteam|security|injection|tenant|oauth).*\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const FULL_SHA = /^[a-f0-9]{40}$/i;
const shaAllowed = (value) => typeof value === 'string' && FULL_SHA.test(value);

export async function collectFiles(root, directories, depthLimit = 7) {
  const files = [];
  async function scan(directory, depth) {
    if (depth > depthLimit) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) continue;
      if (['node_modules', '.git', 'dist', 'coverage', '.wrangler', '.next'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await scan(path, depth + 1);
      else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'));
      if (files.length > MAX_FILES) throw new Error('SKILL_AUDIT_SCOPE_EXCEEDED');
    }
  }
  for (const path of directories) await scan(resolve(root, path), 0);
  return [...new Set(files)].sort();
}

/** An untrusted receipt can only qualify for independent verification.
 * This parser NEVER grants authority or marks a scenario VERIFIED.
 */
export function assessDefensivePromotion(receipt, headSha) {
  const reasons = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { eligibleForIndependentReview: false, autoPromote: false, reasons: ['MISSING_RECEIPT'] };
  }
  if (typeof receipt.caseId !== 'string' || !/^[a-z0-9][a-z0-9-_]{2,90}$/i.test(receipt.caseId)) reasons.push('INVALID_CASE_ID');
  if (!shaAllowed(receipt.sourceSha) || !shaAllowed(headSha) || receipt.sourceSha.toLowerCase() !== headSha.toLowerCase()) reasons.push('STALE_OR_INVALID_HEAD');
  if (typeof receipt.testPath !== 'string' || !/^(src|test|tests|e2e)\/[a-z0-9_./-]+\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(receipt.testPath) || receipt.testPath.includes('..')) reasons.push('INVALID_TEST_TARGET');
  if (receipt.runStatus !== 'passed') reasons.push('MISSING_PASS');
  if (typeof receipt.runId !== 'string' || receipt.runId.trim().length < 4) reasons.push('MISSING_RUN_ID');
  if (receipt.scope !== 'defensive-local' && receipt.scope !== 'authorized-ci') reasons.push('UNAUTHORIZED_SCOPE');
  if (receipt.realTestExecuted !== true) reasons.push('NOT_EXECUTED');
  if (receipt.baselineFailureObserved !== true) reasons.push('MISSING_RED_PROOF');
  if (receipt.outcomeReadbackObserved !== true) reasons.push('MISSING_READBACK');
  return {
    eligibleForIndependentReview: reasons.length === 0,
    autoPromote: false,
    reasons,
  };
}

export async function verifyScopedWorkflow(root = REPO_ROOT) {
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (!['founder-control-room', 'chief-ai-machine'].includes(packageJson.name)) {
    throw new Error('UNEXPECTED_REPOSITORY');
  }
  const skill = await readFile(join(root, '.agents/skills/scoped-parallel-proof-workflow/SKILL.md'), 'utf8');
  const prompts = await readFile(join(root, '.agents/skills/scoped-parallel-proof-workflow/references/defensive-review-prompts.md'), 'utf8');
  const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  const required = [
    'More intelligence never means more authority',
    'CANDIDATE -> REPRODUCED -> FIX_AUTHORED',
    'No broad',
    '48000',
    'one execution owner',
    'NOT RUN',
    'Definition of done',
  ];
  for (const value of required) {
    if (!skill.includes(value)) throw new Error(`MISSING_WORKFLOW_RULE: ${value}`);
  }
  for (const value of ['PROMPT 1', 'PROMPT 2', 'PROMPT 3', 'PROMPT 4', 'PROMPT 5', 'PROMPT 6']) {
    if (!prompts.includes(value)) throw new Error(`MISSING_DEFENSIVE_PROMPT: ${value}`);
  }
  if (!agents.includes('scoped-parallel-proof-workflow/SKILL.md')) {
    throw new Error('AGENT_ROUTING_MISSING_WORKFLOW');
  }
  const files = await collectFiles(root, SKILL_ROOTS, 5);
  const sourceSkills = files.filter((path) => /(?:^|\/)(?:SKILL\.md|skill\.yaml)$/.test(path) || /^\.ai-skills\/(?:skills|gpts)\/[^/]+\.md$/.test(path));
  if (sourceSkills.length === 0) throw new Error('NO_SKILL_SOURCES');
  const testFiles = await collectFiles(root, TEST_ROOTS, 8);
  const defensiveTestCandidates = testFiles.filter((path) => ATTACK_TEST_NAME.test(path));
  return {
    contract: 'juss/scoped-parallel-proof-workflow@v1',
    repository: packageJson.name,
    sourceSkillDefinitions: sourceSkills.length,
    defensiveTestCandidates: defensiveTestCandidates.length,
    status: 'SOURCE_CONTRACT_ONLY',
    liveSkillInvocation: 'NOT RUN',
    liveProviderOutcome: 'NOT RUN',
    attackRunsExecutedByInventory: 0,
    autoPromotedSimulations: 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await verifyScopedWorkflow();
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    process.stderr.write('SCOPED_WORKFLOW_VERIFY_FAILED: ' + (error?.message ?? String(error)) + '\n');
    process.exitCode = 1;
  }
}
