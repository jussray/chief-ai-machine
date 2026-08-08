import { readFileSync } from 'node:fs';

const skillPath = new URL('../skills/gmail-resolve/SKILL.md', import.meta.url);
const skill = readFileSync(skillPath, 'utf8');

const checks = [
  ['frontmatter name matches directory', /---\nname: gmail-resolve\n/.test(skill)],
  ['metadata version is quoted and nested', /metadata:\n(?:  .*\n)*  version: "0\.1\.0"/.test(skill)],
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
  ['zero-attacks marketing claim is forbidden', !/zero attacks/i.test(skill)],
  ['output format includes REALITY FIX PROOF RISK ROLLBACK NEXT GATE', /REALITY:[\s\S]+FIX:[\s\S]+PROOF:[\s\S]+RISK:[\s\S]+ROLLBACK:[\s\S]+NEXT GATE:/.test(skill)],
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
