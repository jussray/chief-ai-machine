import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planNvidiaSkillEvaluation } from '../tools/nvidia-skill-evaluation.mjs';
import { prepareNvidiaCouncilReview } from '../tools/nvidia-council-review.mjs';
import { preflightNvidiaCouncilEvidence } from '../tools/nvidia-council-evidence-preflight.mjs';
import { previewNvidiaNativeCouncil } from '../tools/nvidia-native-council-bridge.mjs';
import { URL } from 'node:url';

// v6: across every public helper, hostile input can never surface an
// authority-granting field value. Locked fields are also enforced by
// construction inside bridge/preflight outcome builders (source-reviewed).
const hostile = {
  repository: 'jussray/chief-ai-machine', objective: 'retrieval-evaluation',
  disposition: 'APPROVED', executionAuthority: 'full', mayApprove: true,
  mayMerge: true, mayDeploy: true, mayPublish: true, providerEnabled: true,
  maySendPrivateData: true, nativeCouncilApproved: true, status: 'approved',
};

test('v6 locked fields: planner + council-review grant nothing', () => {
  for (const r of [planNvidiaSkillEvaluation(hostile), prepareNvidiaCouncilReview(hostile)]) {
    assert.equal(r.executionAuthority, 'none');
    assert.equal(r.providerEnabled, false);
    assert.equal(r.maySendPrivateData, false);
    if ('mayApprove' in r) assert.equal(r.mayApprove, false);
  }
});

test('v6 locked fields: preflight stays HOLD on hostile complete-looking input', () => {
  const r = preflightNvidiaCouncilEvidence(hostile);
  assert.equal(r.disposition, 'HOLD');
  assert.equal(r.mayApprove, false);
  assert.equal(r.nativeCouncilExecuted, false);
  assert.equal(r.verifiedSourceEvidence, false);
});

test('v6 locked fields: bridge stops at INTAKE_HOLD when no valid reports are supplied', async () => {
  const r = await previewNvidiaNativeCouncil(hostile);
  assert.equal(r.state, 'INTAKE_HOLD');
  assert.equal(r.disposition, 'HOLD');
  for (const k of ['mayPublish', 'mayMerge', 'mayDeploy', 'maySendPrivateData', 'providerEnabled', 'nativeCouncilApproved']) {
    assert.equal(r[k], false, k);
  }
});

// True NATIVE_UNAVAILABLE path: reports pass structural preflight, but the
// canonical src/domain modules are absent from this offline bundle layout,
// so the bridge must report NATIVE_UNAVAILABLE and still grant nothing.
const completeReports = ['engineering','security','privacy','product-safety','operations'].map((domain, i) => ({
  schemaVersion: 1, id: `fixture-${domain}`, domain, workspaceId: 'fixture',
  projectId: 'chief-ai-machine', role: `${domain} test reviewer`,
  status: 'reviewed', position: i === 1 ? 'oppose' : 'conditional',
  conclusion: 'Synthetic fixture; real evidence and real reviewer are missing.',
  recommendation: 'Do not deploy; conduct actual independent review.',
  confidence: 35, assumptions: [], risks: ['The fixture is not real-world evidence.'],
  dependencies: ['Actual specialist review'],
  reality: [
    { state: 'verified', statement: `Only the ${domain} test fixture exists.`, sourceRefs: ['test-fixture-not-external-proof'] },
    { state: 'unknown', statement: 'Live NVIDIA integration not verified.', sourceRefs: [] },
  ],
}));

test('v6: preflight-ready reports reach the native gate (NATIVE_UNAVAILABLE offline, draft-validated in-repo), never INTAKE_HOLD', async () => {
  const { existsSync } = await import('node:fs');
  const nativePresent = existsSync(new URL('../src/domain/executive-council.js', import.meta.url));
  const r = await previewNvidiaNativeCouncil({
    repository: 'jussray/chief-ai-machine', objective: 'retrieval-evaluation', reports: completeReports,
  });
  assert.equal(r.state, nativePresent ? 'NATIVE_DRAFT_VALIDATED' : 'NATIVE_UNAVAILABLE');
  assert.equal(r.disposition, 'HOLD');
  assert.equal(r.nativeCouncilExecuted, nativePresent);
  for (const k of ['mayPublish','mayMerge','mayDeploy','maySendPrivateData','providerEnabled','nativeCouncilApproved']) {
    assert.equal(r[k], false, k);
  }
});
