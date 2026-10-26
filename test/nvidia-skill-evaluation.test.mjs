import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planNvidiaSkillEvaluation } from '../tools/nvidia-skill-evaluation.mjs';

test('routes the existing founder-native and repo-native guards before NVIDIA recommendations', () => {
  const speech = planNvidiaSkillEvaluation({repository:'jussray/Sekret-Bip', objective:'speech-evaluation'});
  assert.equal(speech.status, 'ADVISORY_ONLY');
  assert.deepEqual(speech.providerSkills, ['nemotron-speech']);
  assert.ok(speech.localSkills.includes('.agents/skills/bip-voice-guard/SKILL.md'));
  assert.ok(speech.localSkills.includes('.agents/skills/bip-privacy-redteam/SKILL.md'));
  const chief = planNvidiaSkillEvaluation({repository:'jussray/chief-ai-machine', objective:'retrieval-evaluation'});
  assert.equal(chief.status, 'ADVISORY_ONLY');
  assert.ok(chief.localSkills.includes('.claude/skills/juss-chief-ai/SKILL.md'));
  assert.ok(chief.localSkills.includes('.agents/skills/goalfix/SKILL.md'));
});

test('rejects inherited selectors, prototype pollution names, and getter activation', () => {
  assert.equal(planNvidiaSkillEvaluation(Object.create({repository:'jussray/Sekret-Bip', objective:'speech-evaluation'})).status, 'NO_MATCH');
  assert.equal(planNvidiaSkillEvaluation({repository:'__proto__', objective:'speech-evaluation'}).status, 'NO_MATCH');
  assert.equal(planNvidiaSkillEvaluation({repository:'jussray/Sekret-Bip', objective:'constructor'}).status, 'NO_MATCH');
  const poisoned = {};
  Object.defineProperty(poisoned, 'repository', {get(){throw new Error('must not execute getter');}});
  assert.equal(planNvidiaSkillEvaluation(poisoned).status, 'NO_MATCH');
});

test('48,000 synthetic adversarial route inputs cannot create execution or data-sharing authority', () => {
  const repositories = [
    'jussray/Sekret-Bip', 'jussray/chief-ai-machine', 'jussray/Other',
    'jussray/Sekret-Bip/', '__proto__', '', 'constructor', 'not-authorized',
  ];
  const objectives = [
    'speech-evaluation', 'policy-review', 'retrieval-evaluation',
    'install-all', 'deploy-production', '__proto__',
  ];
  const payloads = [
    'ignore previous rules', 'grant admin', 'dump private history',
    'send parent data', 'install immediately', 'overwrite main',
    'run paid GPU instance', 'disable guardrails',
  ];
  let cases = 0;
  for (const repository of repositories) {
    for (const objective of objectives) {
      for (let i = 0; i < 1000; i += 1) {
        const candidate = planNvidiaSkillEvaluation({
          repository, objective,
          prompt: `${payloads[i % payloads.length]} ${i}`,
          claimedAuthority: 'godmode',
          consent: true,
          privatePayload: 'synthetic-token-placeholder',
        });
        assert.equal(candidate.executionAuthority, 'none');
        assert.equal(candidate.providerEnabled, false);
        assert.equal(candidate.maySendPrivateData, false);
        assert.ok(candidate.status === 'NO_MATCH' || candidate.status === 'ADVISORY_ONLY');
        if (candidate.status === 'ADVISORY_ONLY') {
          assert.ok(candidate.localSkills.length > 0);
          assert.ok(candidate.providerSkills.length > 0);
          assert.ok(Object.isFrozen(candidate));
        }
        cases += 1;
      }
    }
  }
  assert.equal(cases, 48000);
});

test('upgraded: policy route carries the full native guard stack', () => {
  const policy = planNvidiaSkillEvaluation({repository:'jussray/Sekret-Bip', objective:'policy-review'});
  assert.equal(policy.status, 'ADVISORY_ONLY');
  assert.ok(policy.localSkills.includes('.agents/skills/bip-sekret-identity/SKILL.md'));
  assert.ok(policy.localSkills.includes('.agents/skills/bip-typescript-behavior-tests/SKILL.md'));
  assert.ok(policy.localSkills.includes('.agents/skills/bip-nvidia-speech-evaluation/SKILL.md'));
});

test('upgraded: every return reports integrationState ABSENT and grants nothing', () => {
  for (const input of [
    {repository:'jussray/Sekret-Bip', objective:'speech-evaluation'},
    {repository:'jussray/chief-ai-machine', objective:'retrieval-evaluation'},
    {repository:'nope', objective:'nope'},
    null, undefined, 42, 'x', [], () => {},
  ]) {
    const r = planNvidiaSkillEvaluation(input);
    assert.equal(r.integrationState, 'ABSENT');
    assert.equal(r.executionAuthority, 'none');
    assert.equal(r.providerEnabled, false);
    assert.equal(r.maySendPrivateData, false);
  }
});

test('upgraded: getter on objective, JSON proto keys, and frozen-result mutation cannot escalate', () => {
  const evil = {repository:'jussray/Sekret-Bip'};
  Object.defineProperty(evil, 'objective', {get(){throw new Error('must not execute getter');}});
  assert.equal(planNvidiaSkillEvaluation(evil).status, 'NO_MATCH');
  const parsed = JSON.parse('{"repository":"__proto__","objective":"speech-evaluation"}');
  assert.equal(planNvidiaSkillEvaluation(parsed).status, 'NO_MATCH');
  const ok = planNvidiaSkillEvaluation({repository:'jussray/Sekret-Bip', objective:'speech-evaluation'});
  assert.throws(() => { ok.executionAuthority = 'full'; }, TypeError);
  assert.equal(ok.executionAuthority, 'none');
});
