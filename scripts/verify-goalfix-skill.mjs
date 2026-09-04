import { readFileSync } from 'node:fs';

const skillPath = new URL('../.agents/skills/goalfix/SKILL.md', import.meta.url);
const mirrorPath = new URL('../.claude/skills/goalfix/SKILL.md', import.meta.url);
const founderPath = new URL('../AGENTS_FOUNDER_INTELLIGENCE.md', import.meta.url);
const skill = readFileSync(skillPath, 'utf8');
const mirror = readFileSync(mirrorPath, 'utf8');
const founder = readFileSync(founderPath, 'utf8');

const continuityChain = 'REACQUIRE → CLASSIFY → REPAIR → ROLL FORWARD → EXPIRE PROOF → VERIFY → PLAYWRIGHT → REVIEW → MERGE GATE → POST-MERGE TRUTH';

const checks = [
  ['frontmatter name matches directory', /---\nname: goalfix\n/.test(skill)],
  ['description front-loads repository repair scope', /description: Use for repository repair, implementation blockers, CI failures/.test(skill)],
  ['metadata version is present', /metadata:\n(?: {2}.*\n)* {2}version: "1\.2\.0"/.test(skill)],
  ['Codex explicit invocation is documented', /Codex explicit invocation is `\$goalfix`/.test(skill)],
  ['preflight requires repo carrier base and head', /AUTHORITATIVE REPO:[\s\S]+EXISTING PR \/ CARRIER:[\s\S]+TARGET BASE \/ CURRENT MAIN SHA:[\s\S]+CURRENT HEAD SHA:/.test(skill)],
  ['preflight requires proof rollback and stop condition', /PROOF REQUIRED:[\s\S]+ROLLBACK:[\s\S]+STOP CONDITION:/.test(skill)],
  ['truth states include current and stale classifications', /`VERIFIED`:[\s\S]+`INFERRED`:[\s\S]+`UNKNOWN`:[\s\S]+`BLOCKED`:[\s\S]+`STALE`:[\s\S]+`CLEARED`:/.test(skill)],
  ['unobserved evidence cannot become false', /Missing, null, skipped, unavailable, and unobserved are not automatically false/.test(skill)],
  ['expected identity cannot masquerade as observed identity', /Expected identity must never masquerade as observed identity/.test(skill)],
  ['end-to-end continuity chain is explicit', skill.includes(continuityChain)],
  ['same-carrier continuity is required', /Continue the existing PR\/carrier/.test(skill)],
  ['main rollover stays on same carrier', /When `main` advances, bring current `main` into the same carrier/.test(skill)],
  ['predecessor proof expires after mutation', /Any code, metadata, base, merge, rebase, or head mutation expires predecessor exact-head proof/.test(skill)],
  ['predecessor green cannot be inherited', /Never inherit green from a predecessor SHA/.test(skill)],
  ['metadata-only failures do not force source patches', /Do not create a source commit merely to make a metadata gate green/.test(skill)],
  ['rulesets and required checks remain fail closed', /Never weaken a ruleset, required check, review requirement, CodeQL boundary, or provider policy/.test(skill)],
  ['loop maps goal to smallest valid move', /GOAL → CURRENT STATE → BOTTLENECK → SMALLEST VALID MOVE/.test(skill)],
  ['smallest reversible patch is required', /smallest reversible patch/.test(skill)],
  ['gate weakening is forbidden', /do not suppress tests, lint, type checks, release gates/.test(skill)],
  ['Playwright is required for affected browser paths', /Playwright is required when the change can affect browser-visible UI/.test(skill)],
  ['Playwright inapplicable state is explicit', /mark Playwright `INAPPLICABLE`/.test(skill)],
  ['red-team binds proof to final candidate SHA', /proof tied to the final candidate SHA/.test(skill)],
  ['merge review requires final diff and governance state', /Review the final diff and governance state, not a predecessor snapshot/.test(skill)],
  ['skipped required checks remain blockers', /skipped required checks are blockers/.test(skill)],
  ['merge uses expected head SHA', /Use the expected head SHA when executing a merge/.test(skill)],
  ['post-merge truth records landed merge main SHA', /record the landed merge\/main SHA/.test(skill)],
  ['production proof chain is explicit', /SOURCE → BUILD → DEPLOY → LIVE IDENTITY → HEALTH → REAL PATH → OUTCOME/.test(skill)],
  ['confess preserves stale-proof uncertainty', /predecessor proof expired by a later head\/base change/.test(skill)],
  ['final report contract is complete', /REALITY:[\s\S]+FIX:[\s\S]+PROOF:[\s\S]+RISK:[\s\S]+ROLLBACK:[\s\S]+NEXT GATE:/.test(skill)],
  ['Claude mirror carries the same continuity chain', mirror.includes(continuityChain)],
  ['Claude mirror preserves same carrier', /Preserve the existing carrier/.test(mirror)],
  ['Claude mirror expires predecessor proof', /expires predecessor exact-head proof/.test(mirror)],
  ['Claude mirror requires expected-head merge', /Use the expected head SHA/.test(mirror)],
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
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Goalfix skill verification passed (${checks.length} checks).`);
