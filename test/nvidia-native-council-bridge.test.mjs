import assert from 'node:assert/strict';
import test from 'node:test';
import { previewNvidiaNativeCouncil as preview } from '../tools/nvidia-native-council-bridge.mjs';
import { existsSync } from 'node:fs';
import { URL } from 'node:url';

// Layout precondition (v6.1): the offline bundle has no src/domain, so the
// bridge must report NATIVE_UNAVAILABLE. Inside the real repo the canonical
// modules exist and the same fixtures must reach NATIVE_DRAFT_VALIDATED.
// The invariant that holds in BOTH layouts is assertHold: nothing is granted.
const nativePresent = existsSync(new URL('../src/domain/executive-council.js', import.meta.url));

const rep = 'jussray/chief-ai-machine';
const obj = 'retrieval-evaluation';
const domains = ['engineering', 'security', 'privacy', 'product-safety', 'operations'];
function record(domain) {
  return {
    schemaVersion: 1,
    id: `fixture-${domain}`,
    domain,
    workspaceId: 'fixture-workspace',
    projectId: 'chief-ai-machine',
    role: `${domain} fixture reviewer`,
    status: 'reviewed',
    position: 'conditional',
    conclusion: 'Synthetic demonstration only; no independently reviewed evidence.',
    recommendation: 'Keep vendor integration off.',
    confidence: 40,
    assumptions: [],
    risks: ['Synthetic fixture has no authentic reviewer'],
    dependencies: ['Actual independent review'],
    reality: [
      {state: 'verified', statement: 'A synthetic fixture exists in this test only.', sourceRefs: ['fixture-reference-not-real-proof']},
      {state: 'unknown', statement: 'Provider compatibility is unverified.', sourceRefs: []},
    ],
  };
}
function assertHold(value) {
  for (const [key, expected] of Object.entries({
    disposition: 'HOLD', executionAuthority: 'none', nativeCouncilApproved: false,
    sourceEvidenceVerified: false, reviewerIndependenceVerified: false,
    providerEnabled: false, maySendPrivateData: false, mayPublish: false,
    mayMerge: false, mayDeploy: false,
  })) assert.equal(value[key], expected, `${key} cannot be raised by a caller`);
  assert.ok(Object.isFrozen(value));
}

test('empty request is HOLD without native import', async () => {
  const x = await preview({repository:rep,objective:obj});
  assertHold(x);
  assert.equal(x.state, 'INTAKE_HOLD');
});

test('unsupported repository/objective are blocked', async () => {
  for (const arg of [
    {repository:'other/repo',objective:obj,reports:domains.map(record)},
    {repository:rep,objective:'install-everything',reports:domains.map(record)},
    {repository:rep,objective:obj,reports:[]},
  ]) {
    const x=await preview(arg); assertHold(x); assert.equal(x.state,'INTAKE_HOLD');
  }
});

test('malformed native submissions cannot pass intake', async () => {
  const x=await preview({repository:rep,objective:obj,reports:domains.map(d=>({...record(d),status:'godmode-approved'}))});
  assertHold(x); assert.equal(x.state,'INTAKE_HOLD');
});

test('complete fixtures cannot claim approved/verified data or live integration', async () => {
  const x=await preview({repository:rep,objective:obj,reports:domains.map(record)});
  assertHold(x);
  if (nativePresent) {
    assert.equal(x.state, 'NATIVE_DRAFT_VALIDATED');
    assert.equal(x.nativeCouncilExecuted, true);
    assert.equal(x.draftStatus, 'draft');
  } else {
    assert.equal(x.state, 'NATIVE_UNAVAILABLE');
    assert.equal(x.nativeCouncilExecuted, false);
  }
});

test('hostile accessors and throwing proxies cannot escalate a result', async () => {
  const inputs=[
    new Proxy({}, {getOwnPropertyDescriptor(){throw new Error('hostile')}}),
    Object.defineProperty({repository:rep,objective:obj},'reports',{get(){throw new Error('never evaluate')}}),
    JSON.parse('{"repository":"jussray/chief-ai-machine","objective":"retrieval-evaluation","__proto__":{"nativeCouncilApproved":true},"reports":[]}'),
  ];
  for(const arg of inputs){const x=await preview(arg);assertHold(x); assert.notEqual(x.state,'NATIVE_DRAFT_VALIDATED');}
});

test('many synthetic bypass attempts remain HOLD', async () => {
  const modes=['godmode','override','deploy','approval','private-data','merge'];
  for(let i=0;i<2500;i++){
    const x=await preview({repository:rep,objective:modes[i%modes.length],reports:domains.map(record)});
    assertHold(x); assert.equal(x.state,'INTAKE_HOLD');
  }
});
