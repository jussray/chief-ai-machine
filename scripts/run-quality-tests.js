import assert from 'node:assert/strict';
import { CHIEF_AI_GUARDRAILS, CHIEF_AI_VISION, validateChiefImportPayload } from '../src/config/visionGuardrails.js';

assert.equal(CHIEF_AI_VISION.stage, 'prototype');
assert.equal(CHIEF_AI_GUARDRAILS.some(item => item.id === 'CHIEF-IMPORT-001'), true);

const safe = validateChiefImportPayload({
  custom: [{ id: 1, title: 'Safe prompt', body: 'Do the work.', platforms: ['chatgpt'] }],
  stars: [1, 1, 2],
});
assert.equal(safe.custom.length, 1);
assert.deepEqual(safe.stars, [1, 2]);

assert.throws(() => validateChiefImportPayload({ custom: {}, stars: [] }));
assert.throws(() => validateChiefImportPayload({ custom: [], stars: [] }, 1024 * 1024 + 1));

console.log('Chief AI quality guardrail checks passed.');
