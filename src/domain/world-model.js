// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const WORLD_PREDICTION_SCHEMA_VERSION = 1;
export const LEARNING_DELTA_SCHEMA_VERSION = 1;

export const WORLD_MODEL_AUTHORITY = Object.freeze({
  scope: 'advisory-only',
  permitsExecution: false,
  permitsPublishing: false,
  permitsDeployment: false,
  permitsBilling: false,
  permitsApproval: false,
  permitsAuthorityTransfer: false,
});

const DECISIONS = new Set(['compound', 'modify', 'retest', 'kill', 'hold']);
const FINDINGS = new Set(['confirmed', 'contradicted', 'inconclusive']);
const CAUSALITY = new Set(['unknown', 'inferred', 'verified']);

function text(value, max = 2000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function textList(values, maxItems = 20, maxLength = 500) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => text(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function confidence(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : fallback;
}

function iso(value) {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString();
}

function authority() {
  return { ...WORLD_MODEL_AUTHORITY };
}

function id(prefix, experimentId, now) {
  const token = text(experimentId, 120).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'experiment';
  return `${prefix}-${token}-${now.getTime()}`;
}

function authorityIsAdvisory(value) {
  return value
    && value.scope === 'advisory-only'
    && value.permitsExecution === false
    && value.permitsPublishing === false
    && value.permitsDeployment === false
    && value.permitsBilling === false
    && value.permitsApproval === false
    && value.permitsAuthorityTransfer === false;
}

export function createWorldPredictionReceipt(input = {}, now = new Date()) {
  const experimentId = text(input.experimentId, 180);
  const hypothesis = text(input.hypothesis, 2000);
  const predictions = Array.isArray(input.predictions) ? input.predictions : [];
  if (!experimentId) throw new Error('World prediction requires experimentId');
  if (!hypothesis) throw new Error('World prediction requires a hypothesis');
  if (predictions.length === 0) throw new Error('World prediction requires at least one metric prediction');

  const normalizedPredictions = predictions.map((prediction, index) => {
    const metric = text(prediction?.metric, 120);
    const expectation = text(prediction?.expectation, 500);
    if (!metric || !expectation) throw new Error(`World prediction metric ${index + 1} is incomplete`);
    return {
      metric,
      expectation,
      direction: text(prediction?.direction, 40) || 'unknown',
      confidence: confidence(prediction?.confidence, 0.5),
    };
  });

  return {
    schemaVersion: WORLD_PREDICTION_SCHEMA_VERSION,
    kind: 'chief/world-prediction-receipt',
    id: text(input.id, 180) || id('world-prediction', experimentId, now),
    workspaceId: text(input.workspaceId, 120) || 'default',
    projectId: text(input.projectId, 120) || 'general',
    experimentId,
    hypothesis,
    predictions: normalizedPredictions,
    assumptions: textList(input.assumptions, 20, 500),
    evidenceRefs: textList(input.evidenceRefs, 20, 500),
    status: 'active',
    createdAt: now.toISOString(),
    authority: authority(),
  };
}

export function validateWorldPredictionReceipt(receipt) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object') return { valid: false, errors: ['Prediction receipt must be an object'] };
  if (receipt.schemaVersion !== WORLD_PREDICTION_SCHEMA_VERSION) errors.push('Unsupported prediction schema version');
  if (receipt.kind !== 'chief/world-prediction-receipt') errors.push('Unsupported prediction kind');
  if (!text(receipt.id, 180)) errors.push('Missing prediction id');
  if (!text(receipt.experimentId, 180)) errors.push('Missing experiment id');
  if (!text(receipt.hypothesis, 2000)) errors.push('Missing hypothesis');
  if (!Array.isArray(receipt.predictions) || receipt.predictions.length === 0) errors.push('Missing metric predictions');
  if (Array.isArray(receipt.predictions) && receipt.predictions.some((item) => !text(item?.metric, 120) || !text(item?.expectation, 500) || confidence(item?.confidence, -1) < 0)) {
    errors.push('Invalid metric prediction');
  }
  if (!iso(receipt.createdAt)) errors.push('Invalid created timestamp');
  if (!authorityIsAdvisory(receipt.authority)) errors.push('Prediction authority must remain advisory-only');
  return { valid: errors.length === 0, errors };
}

export function createLearningDeltaReceipt(input = {}, now = new Date()) {
  const prediction = input.prediction;
  const observation = input.observation;
  const predictionValidation = validateWorldPredictionReceipt(prediction);
  if (!predictionValidation.valid) throw new Error(`Learning delta requires a valid prediction: ${predictionValidation.errors.join('; ')}`);
  if (!observation || typeof observation !== 'object') throw new Error('Learning delta requires an observation receipt');
  if (text(observation.experimentId, 180) !== prediction.experimentId) throw new Error('Prediction and observation experiment ids must match');

  const decision = text(input.decision, 40);
  if (!DECISIONS.has(decision)) throw new Error('Learning delta decision is unsupported');
  const causality = text(input.causality, 40) || 'unknown';
  if (!CAUSALITY.has(causality)) throw new Error('Learning delta causality status is unsupported');

  const findings = (Array.isArray(input.metricFindings) ? input.metricFindings : []).map((finding, index) => {
    const metric = text(finding?.metric, 120);
    const result = text(finding?.result, 40);
    if (!metric || !FINDINGS.has(result)) throw new Error(`Learning delta metric finding ${index + 1} is invalid`);
    return {
      metric,
      result,
      expected: text(finding?.expected, 500),
      observed: text(finding?.observed, 500),
      evidenceRefs: textList(finding?.evidenceRefs, 10, 500),
    };
  });
  if (findings.length === 0) throw new Error('Learning delta requires at least one metric finding');

  const council = input.council && typeof input.council === 'object' ? input.council : {};
  const dissent = textList(council.dissent, 20, 1000);

  return {
    schemaVersion: LEARNING_DELTA_SCHEMA_VERSION,
    kind: 'chief/learning-delta-receipt',
    id: text(input.id, 180) || id('learning-delta', prediction.experimentId, now),
    workspaceId: prediction.workspaceId,
    projectId: prediction.projectId,
    experimentId: prediction.experimentId,
    predictionReceiptId: prediction.id,
    observationReceiptId: text(observation.id, 180),
    metricFindings: findings,
    decision,
    causality,
    confidenceBefore: confidence(input.confidenceBefore, 0.5),
    confidenceAfter: confidence(input.confidenceAfter, 0.5),
    council: {
      synthesisId: text(council.synthesisId, 180) || null,
      dissentPreserved: dissent.length > 0,
      dissent,
    },
    evidenceRefs: textList(input.evidenceRefs, 20, 500),
    createdAt: now.toISOString(),
    authority: authority(),
  };
}

export function validateLearningDeltaReceipt(receipt) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object') return { valid: false, errors: ['Learning delta must be an object'] };
  if (receipt.schemaVersion !== LEARNING_DELTA_SCHEMA_VERSION) errors.push('Unsupported learning-delta schema version');
  if (receipt.kind !== 'chief/learning-delta-receipt') errors.push('Unsupported learning-delta kind');
  if (!text(receipt.id, 180) || !text(receipt.experimentId, 180)) errors.push('Missing learning-delta identity');
  if (!text(receipt.predictionReceiptId, 180) || !text(receipt.observationReceiptId, 180)) errors.push('Missing source receipt identity');
  if (!DECISIONS.has(receipt.decision)) errors.push('Unsupported decision');
  if (!CAUSALITY.has(receipt.causality)) errors.push('Unsupported causality status');
  if (!Array.isArray(receipt.metricFindings) || receipt.metricFindings.length === 0) errors.push('Missing metric findings');
  if (!iso(receipt.createdAt)) errors.push('Invalid created timestamp');
  if (!authorityIsAdvisory(receipt.authority)) errors.push('Learning authority must remain advisory-only');
  return { valid: errors.length === 0, errors };
}
