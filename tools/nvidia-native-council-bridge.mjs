// Optional, read-only bridge to Chief AI's CANONICAL native Executive Council.
// Uses real repo-native validators WHEN installed in a matching checkout.
// Missing source code, fake reports, or failed validation must never create approval.
// No filesystem writes, vendor requests, installations, or network calls.
import { preflightNvidiaCouncilEvidence } from './nvidia-council-evidence-preflight.mjs';

const SCHEMA = 'juss/nvidia-native-council-handoff@v1';
const FIXED_GATE = 'Independent evidence and author identity checks, exact-head review, founder approval, and separate provider/release gates are required.';
const BASE = Object.freeze({
  schema: SCHEMA,
  disposition: 'HOLD',
  executionAuthority: 'none',
  nativeCouncilApproved: false,
  nativeCouncilExecuted: false,
  sourceEvidenceVerified: false,
  reviewerIndependenceVerified: false,
  providerEnabled: false,
  maySendPrivateData: false,
  mayPublish: false,
  mayMerge: false,
  mayDeploy: false,
});

// Locked fields describe authority, not observation: no `additional` payload
// (present or future) may override them. `nativeCouncilExecuted` is the single
// deliberately unlocked field — it reports an observed fact, defaults false.
const LOCKED = Object.freeze([
  'schema', 'disposition', 'executionAuthority', 'nativeCouncilApproved',
  'sourceEvidenceVerified', 'reviewerIndependenceVerified', 'providerEnabled',
  'maySendPrivateData', 'mayPublish', 'mayMerge', 'mayDeploy',
]);
function outcome(state, reason, additional = {}) {
  const extra = { ...additional };
  for (const key of LOCKED) delete extra[key];
  return Object.freeze({ ...BASE, state, reason, ...extra });
}

function own(object, key) {
  if (object === null || typeof object !== 'object') return undefined;
  const desc = Object.getOwnPropertyDescriptor(object, key);
  return desc && Object.hasOwn(desc, 'value') ? desc.value : undefined;
}

function checkedArray(value, max, mapper) {
  if (!Array.isArray(value)) throw new Error('expected_array');
  const count = own(value, 'length');
  if (!Number.isSafeInteger(count) || count < 0 || count > max) throw new Error('array_limit');
  const out = [];
  for (let index = 0; index < count; index += 1) {
    const desc = Object.getOwnPropertyDescriptor(value, String(index));
    if (!desc || !Object.hasOwn(desc, 'value')) throw new Error('accessor_or_sparse_array');
    out.push(mapper(desc.value));
  }
  return out;
}

function copyPrimitiveFields(source, names, target) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('expected_object');
  for (const name of names) {
    const value = own(source, name);
    if (value === undefined) continue;
    if (typeof value !== 'string' && typeof value !== 'number') throw new Error('invalid_scalar');
    target[name] = value;
  }
}

function copyStrings(value, max) {
  return checkedArray(value, max, (item) => {
    if (typeof item !== 'string' || item.length > 2000) throw new Error('invalid_string_item');
    return item;
  });
}

// Clean-room data snapshot: never hand live caller getters/proxies/prototypes to
// native Council. Excludes all unknown properties and prevents input mutation
// between preliminary checks and native synthesis.
function snapshotReports(reports) {
  return checkedArray(reports, 5, (report) => {
    const out = {};
    copyPrimitiveFields(report, [
      'schemaVersion', 'id', 'workspaceId', 'projectId', 'role',
      'domain', 'position', 'conclusion', 'recommendation',
      'confidence', 'status', 'source', 'createdAt', 'updatedAt',
    ], out);
    for (const field of ['assumptions', 'risks', 'dependencies']) {
      const value = own(report, field);
      if (value !== undefined) out[field] = copyStrings(value, 30);
    }
    out.reality = checkedArray(own(report, 'reality'), 50, (item) => {
      const reality = {};
      copyPrimitiveFields(item, ['state', 'statement'], reality);
      reality.sourceRefs = copyStrings(own(item, 'sourceRefs'), 20);
      const receipts = own(item, 'receiptIds');
      if (receipts !== undefined) reality.receiptIds = copyStrings(receipts, 20);
      return reality;
    });
    return out;
  });
}

/**
 * Returns HOLD in EVERY path. Caller-supplied "verified" labels are NOT proof.
 * Even real native schema validation yields only a non-persistent draft preview.
 */
export async function previewNvidiaNativeCouncil(input) {
  let intake;
  let repository;
  let objective;
  let reports;
  try {
    repository = own(input, 'repository');
    objective = own(input, 'objective');
    reports = own(input, 'reports');
    intake = preflightNvidiaCouncilEvidence(input);
    if (intake.state !== 'READY_FOR_NATIVE_VALIDATION') {
      return outcome('INTAKE_HOLD', 'Structural preflight is not ready; native Council not invoked', { intakeState: intake.state });
    }
    reports = snapshotReports(reports);
  } catch {
    return outcome('REJECTED', 'Cannot safely snapshot the specialist submissions');
  }

  let specialist, council, brief;
  try {
    // NEVER substitute mocks in this production API: these are fixed imports
    // into the REAL Chief AI repository's canonical domain modules.
    [specialist, council, brief] = await Promise.all([
      import('../src/domain/specialist-report.js'),
      import('../src/domain/executive-council.js'),
      import('../src/domain/executive-brief.js'),
    ]);
  } catch {
    return outcome('NATIVE_UNAVAILABLE', 'Canonical Chief AI Council modules not available in this workspace');
  }

  try {
    for (const report of reports) {
      const validation = specialist.validateSpecialistReport(report);
      if (!validation.valid) return outcome('NATIVE_REJECTED', 'Canonical SpecialistReport validation rejected submitted structure');
    }

    const now = new Date();
    const synthesis = council.synthesizeExecutiveCouncil({
      workspaceId: reports[0].workspaceId,
      projectId: reports[0].projectId,
      decision: `Evaluate optional NVIDIA ${objective} for ${repository} without provider activation`,
      nextGate: FIXED_GATE,
      reports,
      status: 'draft', // ALWAYS draft; never assert approved/reviewed.
    }, now);
    const councilValidation = council.validateExecutiveCouncilSynthesis(synthesis);
    const briefValidation = brief.validateExecutiveBrief(synthesis.brief);
    if (!councilValidation.valid || !briefValidation.valid || synthesis.brief.status !== 'draft') {
      return outcome('NATIVE_REJECTED', 'Canonical Council or Executive Brief validation rejected the draft');
    }
    const evidenceStates = Object.freeze(Object.fromEntries(
      ['verified', 'inferred', 'unknown', 'blocked'].map((state) => [
        state, synthesis.evidence.filter((e) => e.state === state).length,
      ]),
    ));
    const positions = Object.freeze(Object.fromEntries(
      ['support', 'conditional', 'oppose', 'abstain'].map((position) => [
        position, synthesis.positions[position].length,
      ]),
    ));
    // Data-minimized preview; no private source text, raw receipts, report
    // conclusions, or vendor payloads leave this function.
    return outcome('NATIVE_DRAFT_VALIDATED',
      'Canonical validators ran on caller-supplied records; authenticity, independence, and real-world evidence remain unverified', {
        nativeCouncilExecuted: true,
        draftStatus: 'draft',
        reportCount: synthesis.reportIds.length,
        dissentCount: synthesis.brief.dissent.length,
        positions,
        evidenceStates,
        nativeConfidence: synthesis.confidence.final,
        nextGate: FIXED_GATE,
      });
  } catch {
    return outcome('NATIVE_REJECTED', 'Native Council raised an error or could not safely process submitted records');
  }
}
