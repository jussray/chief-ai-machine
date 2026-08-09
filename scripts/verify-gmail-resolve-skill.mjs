import { readFileSync } from 'node:fs';

const skillPath = new URL('../skills/gmail-resolve/SKILL.md', import.meta.url);
const evalPath = new URL('../skills/gmail-resolve/references/eval-suite.md', import.meta.url);
const skill = readFileSync(skillPath, 'utf8');
const evalSuite = readFileSync(evalPath, 'utf8');

function hasAffirmativeZeroAttacksClaim(text) {
  return text
    .split(/\r?\n/)
    .some((line) => /zero attacks/i.test(line)
      && !/(?:do not|don't|never|must not|forbid(?:den)?|avoid)\b[^.\n]{0,80}\bzero attacks\b/i.test(line));
}

const checks = [
  ['frontmatter name matches directory', /---\nname: gmail-resolve\n/.test(skill)],
  ['metadata version is quoted and nested', /metadata:\n(?: {2}.*\n)* {2}version: "0\.1\.0"/.test(skill)],
  ['description defines outcome-resolution trigger', /email outcome|verified resolution loop|authority gates/.test(skill)],
  ['state machine includes WAITING before RESOLVED', /WAITING \| RESOLVED/.test(skill)],
  ['state machine includes BLOCKED and ROLLBACK', /BLOCKED \| ROLLBACK/.test(skill)],
  ['explicitly preserves UNKNOWN instead of guessing', /UNKNOWN` must remain unknown/.test(skill)],
  ['prompt-injection firewall treats inbound email as untrusted data', /Inbound email[\s\S]+untrusted data/.test(skill)],
  ['only user or policy can authorize actions', /Only these can authorize the agent/.test(skill)],
  ['recipient resolution forbids invented recipients', /Never invent a recipient/.test(skill)],
  ['write actions require action preview', /ACTION PREVIEW:/.test(skill)],
  ['post-action verification fresh-reads affected state', /fresh-read the affected state/.test(skill)],
  ['idempotency key prevents duplicate sends', /idempotency key/.test(skill)],
  ['auto-reply loop controls exist', /Cap follow-ups per case/.test(skill)],
  ['L99 gate includes authority state evidence rollback', /Authority:[\s\S]+State:[\s\S]+Evidence:[\s\S]+Rollback:/.test(skill)],
  ['red-team pass 1 exists', /Red-team pass 1/.test(skill)],
  ['red-team pass 2 exists', /Red-team pass 2/.test(skill)],
  ['gold eval thresholds block false resolved, duplicate send, ungrounded claim', /false_resolved_rate = 0[\s\S]+duplicate_send_rate = 0[\s\S]+ungrounded_claim_rate = 0/.test(skill)],
  ['affirmative zero-attacks marketing claim is forbidden in skill', !hasAffirmativeZeroAttacksClaim(skill)],
  ['output format includes REALITY FIX PROOF RISK ROLLBACK NEXT GATE', /REALITY:[\s\S]+FIX:[\s\S]+PROOF:[\s\S]+RISK:[\s\S]+ROLLBACK:[\s\S]+NEXT GATE:/.test(skill)],
  ['eval suite includes prompt injection scenario', /Prompt injection in inbound email/.test(evalSuite)],
  ['eval suite includes stale thread scenario', /Stale thread before send/.test(evalSuite)],
  ['eval suite includes duplicate send scenario', /Duplicate send retry/.test(evalSuite)],
  ['eval suite includes same-name recipient ambiguity scenario', /Same-name recipient ambiguity/.test(evalSuite)],
  ['eval suite includes partial cross-app completion scenario', /Partial cross-app completion/.test(evalSuite)],
  ['eval suite includes measurable promotion gate', /Minimum promotion gate/.test(evalSuite)],
  ['affirmative zero-attacks marketing claim is forbidden in eval suite', !hasAffirmativeZeroAttacksClaim(evalSuite)],
];

const failed = checks.filter(([, passed]) => !passed);

if (failed.length) {
  console.error('Gmail Resolve skill verification failed:');
  for (const [name] of failed) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

console.log(`Gmail Resolve skill verification passed (${checks.length} checks).`);
