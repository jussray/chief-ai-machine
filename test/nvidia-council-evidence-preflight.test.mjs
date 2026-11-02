import assert from 'node:assert/strict';
import test from 'node:test';
import { preflightNvidiaCouncilEvidence as preflight } from '../tools/nvidia-council-evidence-preflight.mjs';

const repo = 'jussray/chief-ai-machine';
const goal = 'retrieval-evaluation';
const domains = ['engineering', 'security', 'privacy', 'product-safety', 'operations'];
const report = (domain) => ({
  schemaVersion: 1,
  id: `observed-${domain}`,
  domain,
  workspaceId: 'juss',
  projectId: 'chief-ai-machine',
  role: `${domain} reviewer`,
  status: 'reviewed',
  position: 'conditional',
  conclusion: 'Requires real review evidence.',
  recommendation: 'Do not activate the NVIDIA provider yet.',
  confidence: 50,
  dependencies: ['Approve an independent native Council review.'],
  reality: [{ state: 'verified', statement: 'Example cited source exists in a test fixture only.', sourceRefs: ['fixture-only-not-independent-proof'] }],
});

function args(reports) { return {repository: repo, objective: goal, reports}; }
function invariants(x) {
  assert.equal(x.disposition, 'HOLD');
  assert.equal(x.mayApprove, false);
  assert.equal(x.providerEnabled, false);
  assert.equal(x.maySendPrivateData, false);
  assert.equal(x.nativeCouncilExecuted, false);
  assert.equal(x.verifiedSourceEvidence, false);
  assert.equal(x.executionAuthority, 'none');
  assert.equal(Object.isFrozen(x), true);
}

test('reports absent: incomplete and never a Council outcome', () => {
  const x = preflight({repository:repo,objective:goal});
  invariants(x);
  assert.equal(x.state, 'INCOMPLETE');
  assert.equal(x.receivedDomains.length, 0);
});

test('exact five sample reports: structurally ready, not independently proven', () => {
  const x = preflight(args(domains.map(report)));
  invariants(x);
  assert.equal(x.state, 'READY_FOR_NATIVE_VALIDATION');
  assert.equal(x.receivedDomains.length, 5);
  assert.match(x.reasons[0], /not independently verified/);
});

test('missing, duplicate, cross-project and cross-workspace reports fail closed', () => {
  const noOperations = preflight(args(domains.slice(0,4).map(report)));
  invariants(noOperations);
  assert.equal(noOperations.state, 'INCOMPLETE');
  const dup = preflight(args([report('engineering'),report('engineering')]));
  invariants(dup);
  assert.equal(dup.state, 'REJECTED');
  const wrongProject = {...report('engineering'), projectId:'Sekret-Bip'};
  assert.equal(preflight(args([wrongProject])).state, 'REJECTED');
  const crossScope = domains.map(report);
  crossScope[1].workspaceId = 'other-tenant';
  assert.equal(preflight(args(crossScope)).state, 'REJECTED');
});

test('invalid source refs, unsupported position and fake approvals are rejected', () => {
  const noRefs = report('security');
  noRefs.reality[0].sourceRefs = [];
  assert.equal(preflight(args([noRefs])).state, 'REJECTED');
  const fakeStatus = {...report('security'),status:'godmode-approved'};
  assert.equal(preflight(args([fakeStatus])).state, 'REJECTED');
  const unreviewed = {...report('security'),status:'draft'};
  assert.equal(preflight(args([unreviewed])).state, 'REJECTED');
  const fakeVote = {...report('security'),position:'auto-approve'};
  assert.equal(preflight(args([fakeVote])).state, 'REJECTED');
});

test('hostile getters, prototype pollution and throwing proxy are inert', () => {
  const getter = Object.defineProperty({}, 'reports', { get() { throw new Error('do not run'); } });
  getter.repository=repo; getter.objective=goal;
  invariants(preflight(getter));
  const polluted=JSON.parse('{"repository":"jussray/chief-ai-machine","objective":"retrieval-evaluation","__proto__":{"mayApprove":true},"reports":[]}');
  invariants(preflight(polluted));
  const hostile=new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('read trap'); } });
  invariants(preflight(hostile));
});

test('3000 synthetic malformed report cases remain advisory only', () => {
  const unusual = [null, 0, false, 'approved', [], {}, {domain:'__proto__'}, {status:'approved'}, {reality:[{state:'verified'}]}, ...domains.map(d=>({domain:d}))];
  for (let i=0;i<3000;i++) {
    let sample=unusual[i%unusual.length];
    const x = preflight(args([sample]));
    invariants(x);
    assert.notEqual(x.state,'READY_FOR_NATIVE_VALIDATION');
  }
});

test('hostile array proxies fail closed even if length or items throw', () => {
  const badReports = new Proxy([report('engineering')], {
    get(t,k,r) { if (k === 'length' || k === '0') throw new Error('hostile index'); return Reflect.get(t,k,r); },
  });
  const a = preflight(args(badReports));
  invariants(a);
  assert.equal(a.state, 'REJECTED');
  const badReality = new Proxy(report('security').reality, {
    get(t,k,r) { if (k === Symbol.iterator) throw new Error('hostile iteration'); return Reflect.get(t,k,r); },
  });
  const b = preflight(args([{...report('security'),reality:badReality}]));
  invariants(b);
  assert.equal(b.state, 'REJECTED');
});
