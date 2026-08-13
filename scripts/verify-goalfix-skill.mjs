import { readFileSync } from 'node:fs';

const skillPath = new URL('../.agents/skills/goalfix/SKILL.md', import.meta.url);
const founderPath = new URL('../AGENTS_FOUNDER_INTELLIGENCE.md', import.meta.url);
const skill = readFileSync(skillPath, 'utf8');
const founder = readFileSync(founderPath, 'utf8');

const checks = [
  ['frontmatter name matches directory', /---\nname: goalfix\n/.test(skill)],
  ['description front-loads repository repair scope', /description: Use for repository repair, implementation blockers, CI failures/.test(skill)],
  ['metadata version is present', /metadata:\n(?: {2}.*\n)* {2}version: "1\.1\.0"/.test(skill)],
  ['Codex explicit invocation is documented', /Codex explicit invocation is `\$goalfix`/.test(skill)],
  ['preflight requires authoritative repo and current SHA', /AUTHORITATIVE REPO:[\s\S]+TARGET BASE \/ CURRENT SHA:/.test(skill)],
  ['preflight requires proof rollback and stop condition', /PROOF REQUIRED:[\s\S]+ROLLBACK:[\s\S]+STOP CONDITION:/.test(skill)],
  ['truth states include VERIFIED INFERRED UNKNOWN BLOCKED', /`VERIFIED`:[\s\S]+`INFERRED`:[\s\S]+`UNKNOWN`:[\s\S]+`BLOCKED`:/.test(skill)],
  ['unobserved evidence cannot become false', /Missing, null, skipped, unavailable, and unobserved are not automatically false/.test(skill)],
  ['expected identity cannot masquerade as observed identity', /Expected identity must never masquerade as observed identity/.test(skill)],
  ['loop maps goal to smallest valid move', /GOAL → CURRENT STATE → BOTTLENECK → SMALLEST VALID MOVE/.test(skill)],
  ['smallest reversible patch is required', /smallest reversible patch/.test(skill)],
  ['gate weakening is forbidden', /do not suppress tests, lint, type checks, release gates/.test(skill)],
  ['Playwright is required for affected browser paths', /Playwright is required when the change can affect browser-visible UI/.test(skill)],
  ['Playwright inapplicable state is explicit', /mark Playwright `INAPPLICABLE`/.test(skill)],
  ['red-team binds proof to final candidate SHA', /proof tied to the final candidate SHA/.test(skill)],
  ['merge gate distinguishes readiness from completion', /Do not equate `code-ready`[\s\S]+production-live/.test(skill)],
  ['stale-base handling requires refreshed exact-head proof', /If the base moves[\s\S]+prove the refreshed exact head/.test(skill)],
  ['Codex branch convention is date-stamped', /codex\/\{feature\}-\{date\}/.test(skill)],
  ['production proof chain is explicit', /SOURCE → BUILD → DEPLOY → LIVE IDENTITY → HEALTH → REAL PATH → OUTCOME/.test(skill)],
  ['confess section preserves material uncertainty', /tests not executed[\s\S]+browser proof unavailable[\s\S]+provider state inaccessible/.test(skill)],
  ['final report contract is complete', /REALITY:[\s\S]+FIX:[\s\S]+PROOF:[\s\S]+RISK:[\s\S]+ROLLBACK:[\s\S]+NEXT GATE:/.test(skill)],
  ['founder entrypoint declares portable command surface', founder.includes('Portable Juss OS command surface:')],
  ['portable goalfix routes to repo-scoped skill', founder.includes('`/goalfix` routes to the repo-scoped `.agents/skills/goalfix/SKILL.md` contract')],
  ['portable modes cannot expand execution authority', founder.includes('never expand execution authority')],
  ['visualize remains non-authorizing', founder.includes('does not authorize browser, design, deployment, publishing, or production changes by itself')],
  ['repository proof and approval gates remain authoritative', founder.includes('exact-head checks, Playwright requirements, Founder Control Room release truth, and explicit founder gates remain authoritative')],
];

for (const command of ['/goalfix', '/ultrathink', '/truthmode', '/confess', '/redteam', '/lindymode', '/ooda', '/visualize']) {
  checks.push([`portable command is present: ${command}`, founder.includes(command)]);
}

const failed = checks.filter(([, passed]) => !passed);

if (failed.length) {
  console.error('Goalfix skill verification failed:');
  for (const [name] of failed) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

console.log(`Goalfix skill verification passed (${checks.length} checks).`);
