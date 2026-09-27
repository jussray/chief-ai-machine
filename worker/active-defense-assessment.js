const INPUT_CONTRACT = 'juss/active-defense@v1';
export const ASSESSMENT_CONTRACT = 'chief/active-defense-assessment@v1';

const REQUIRED_FLOWS = Object.freeze([
  'attack10',
  'attack20',
  'attack30',
  'attack3000',
  'attack5000',
  'attack6000',
  'attack48000',
  'redteamI',
  'redteamII',
  'redteamTwin',
  'devil',
  'lindymode',
  'l99',
  'ooda',
  'truthmode',
  'confess',
  'goalfix',
  'proofMode',
  'continuity',
  'rollback',
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function assessActiveDefenseEvidence(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('Active-defense evidence must be an object');
  }
  if (input.contract !== INPUT_CONTRACT) {
    throw new Error('Active-defense evidence contract mismatch');
  }

  const actorFingerprint = text(input.actorFingerprint);
  const incidentFingerprint = text(input.incidentFingerprint);
  if (!/^[a-f0-9]{64}$/i.test(actorFingerprint)) {
    throw new Error('Active-defense actor fingerprint is invalid');
  }
  if (!/^[a-f0-9]{64}$/i.test(incidentFingerprint)) {
    throw new Error('Active-defense incident fingerprint is invalid');
  }

  const flowNames = Array.isArray(input.attackUnit)
    ? input.attackUnit.map((entry) => text(entry?.flow)).filter(Boolean)
    : [];
  const missingFlows = REQUIRED_FLOWS.filter((flow) => !flowNames.includes(flow));
  const risk = finiteNumber(input.risk);
  const logicalExpansion = finiteNumber(input.logicalExpansion);
  const controls = input.controls && typeof input.controls === 'object' ? input.controls : {};

  const boundarySafe = controls.outboundProbe === false
    && controls.productionExposure === 0
    && controls.realCredentialsExposed === 0
    && controls.customerDataExposed === 0;
  const completeUnit = missingFlows.length === 0;
  const evidenceComplete = risk !== null && logicalExpansion !== null && completeUnit;

  let recommendation = 'OBSERVE';
  if (!boundarySafe || !evidenceComplete) recommendation = 'CONTAIN_ONLY';
  else if (input.verdict === 'HALLWAY') recommendation = 'CONTINUE_BOUNDED_HALLWAY';
  else if (input.verdict === 'VERIFIED_BOT') recommendation = 'ALLOW_VERIFIED_AUTOMATION';
  else if (risk >= 70) recommendation = 'CONTAIN_ONLY';

  return {
    contract: ASSESSMENT_CONTRACT,
    sourceContract: INPUT_CONTRACT,
    actorFingerprint,
    incidentFingerprint,
    recommendation,
    risk,
    logicalExpansion,
    missingFlows,
    evidenceComplete,
    boundarySafe,
    attribution: {
      technicalActorCorrelated: actorFingerprint.length === 64,
      humanIdentity: 'UNKNOWN_UNLESS_INDEPENDENTLY_VERIFIED',
    },
    authority: {
      stateAuthority: 'founder-control-room',
      recommendationOnly: true,
      canMerge: false,
      canDeploy: false,
      canMutateProvider: false,
      canProbeThirdParty: false,
      canWidenHallwayAuthority: false,
    },
  };
}
