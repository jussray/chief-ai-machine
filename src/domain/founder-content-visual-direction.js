const CREATIVE_MODES = new Set(['cinematic-proof', 'mythic-founder', 'dream-product', 'character-story', 'product-experience']);
const FORMS = new Set(['hero-still-4x5', 'short-video-9x16', 'carousel', 'loop-clip', 'product-surface']);
const EMOTIONS = new Set(['wonder', 'awe', 'tension', 'revelation', 'elegance', 'ambition', 'intimacy', 'inevitability', 'joy', 'safety', 'belonging']);

function text(value, max = 360) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function norm(value) {
  return text(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function list(value, max = 8) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 160)).filter(Boolean))].slice(0, max);
}

function reject(errors) {
  throw Object.assign(new Error(`FOUNDER_CONTENT_VISUAL_REJECTED: ${errors.join('; ')}`), {
    code: 'FOUNDER_CONTENT_VISUAL_REJECTED',
    details: errors,
  });
}

export function buildFounderContentVisualDirection(input = {}, context = {}) {
  const errors = [];
  const thesis = text(context.thesis, 360);
  const creativeMode = text(input.creative_mode, 80).toLowerCase();
  const form = text(input.form, 80).toLowerCase();
  const emotionalIntent = list(input.emotional_intent, 2).map((value) => value.toLowerCase());
  const visualHook = text(input.visual_hook, 360);
  const sceneConcept = text(input.scene_concept, 420);
  const motionLanguage = text(input.motion_language, 360);
  const memoryLine = text(input.memory_line, 240);
  const humanOutcome = text(input.human_outcome, 320);
  const proofObject = text(input.proof_object, 280);
  const proofTruthBoundary = text(input.proof_truth_boundary, 360);
  const targets = list(input.targets, 8).map((value) => value.toLowerCase());

  if (!thesis) errors.push('context.thesis is required');
  if (!CREATIVE_MODES.has(creativeMode)) errors.push('creative_mode is invalid');
  if (!FORMS.has(form)) errors.push('form is invalid');
  if (emotionalIntent.length === 0 || emotionalIntent.some((value) => !EMOTIONS.has(value))) {
    errors.push('emotional_intent must contain one or two approved emotional states');
  }
  if (!visualHook) errors.push('visual_hook is required');
  if (!sceneConcept) errors.push('scene_concept is required');
  if (!memoryLine) errors.push('memory_line is required');
  if (!humanOutcome) errors.push('human_outcome is required');
  if (!proofObject) errors.push('proof_object is required');
  if (!proofTruthBoundary) errors.push('proof_truth_boundary is required');
  if (targets.length === 0) errors.push('targets must name at least one destination');

  if (norm(sceneConcept) === norm(thesis)) {
    errors.push('scene_concept must interpret the thesis rather than restate it literally');
  }
  if (norm(visualHook) === norm(thesis)) {
    errors.push('visual_hook must create curiosity rather than restate the thesis');
  }
  if ((form === 'short-video-9x16' || form === 'loop-clip' || form === 'product-surface') && !motionLanguage) {
    errors.push('motion_language is required for moving or interactive media');
  }
  if (input.preserves_human_agency !== true) errors.push('preserves_human_agency must be true');
  if (input.uses_manipulative_dark_patterns === true) errors.push('uses_manipulative_dark_patterns must be false');
  if (errors.length > 0) reject(errors);

  return Object.freeze({
    version: 1,
    kind: 'chief-ai/founder-content-visual-direction',
    creative_mode: creativeMode,
    form,
    emotional_intent: emotionalIntent,
    visual_hook: visualHook,
    scene_concept: sceneConcept,
    motion_language: motionLanguage || null,
    memory_line: memoryLine,
    human_outcome: humanOutcome,
    proof_object: proofObject,
    proof_truth_boundary: proofTruthBoundary,
    targets,
    attack_2000: Object.freeze({
      reasoning_pressure_budget: 2000,
      external_test_count_claimed: false,
      concept_attack_required: true,
      rendered_artifact_attack_required: true,
    }),
    doctrine: Object.freeze({
      allure_before_explanation: true,
      proof_is_anchor_not_default_composition: true,
      nonliteral_interpretation_required: true,
      platform_native_required: true,
      human_agency_required: true,
    }),
    authority: Object.freeze({
      advisory_only: true,
      publish_authorized: false,
      may_expand_claim_scope: false,
      may_relax_truth_gate: false,
    }),
  });
}
