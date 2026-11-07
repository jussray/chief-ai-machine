// RUN ONLY inside an expressly authorized real Chief AI checkout.
// This fixture verifies canonical native validators are wired correctly.
// These test fixtures are NOT authentic reviews or evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { previewNvidiaNativeCouncil } from '../tools/nvidia-native-council-bridge.mjs';

const domains=['engineering','security','privacy','product-safety','operations'];
const reports=domains.map((domain,i)=>({
  schemaVersion:1, id:`fixture-${domain}`, domain, workspaceId:'fixture',
  projectId:'chief-ai-machine', role:`${domain} test reviewer`,
  status:'reviewed', position:i===1?'oppose':'conditional',
  conclusion:'Synthetic fixture; real evidence and real reviewer are missing.',
  recommendation:'Do not deploy; conduct actual independent review.',
  confidence:35, assumptions:[], risks:['The fixture is not real-world evidence.'],
  dependencies:['Actual specialist review'],
  reality:[
    {state:'verified',statement:`Only the ${domain} test fixture exists.`,sourceRefs:['test-fixture-not-external-proof']},
    {state:'unknown',statement:'Live NVIDIA integration not verified.',sourceRefs:[]},
  ],
}));

test('REAL native Chief AI validators run on isolated synthetic test data, preserving dissent and HOLD',async()=>{
 const x=await previewNvidiaNativeCouncil({
  repository:'jussray/chief-ai-machine', objective:'retrieval-evaluation', reports,
 });
 assert.equal(x.state,'NATIVE_DRAFT_VALIDATED',`native validation did not execute: ${JSON.stringify(x)}`);
 assert.equal(x.nativeCouncilExecuted,true);
 assert.equal(x.draftStatus,'draft');
 assert.equal(x.reportCount,5);
 assert.equal(x.positions.oppose,1);
 assert.equal(x.dissentCount,5);
 assert.equal(x.evidenceStates.unknown,1); // merged duplicate statement
 assert.equal(x.disposition,'HOLD');
 assert.equal(x.nativeCouncilApproved,false);
 assert.equal(x.sourceEvidenceVerified,false);
 assert.equal(x.reviewerIndependenceVerified,false);
 assert.equal(x.providerEnabled,false);
 assert.equal(x.maySendPrivateData,false);
});
