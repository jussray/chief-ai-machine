export const CHIEF_AI_VISION = Object.freeze({
  id: 'chief-ai-founder-control',
  stage: 'prototype',
  northStar: 'Turn founder intent into verified, reversible action while keeping providers replaceable and founder authority explicit.',
  source: 'docs/VISION.md'
});

export const CHIEF_AI_GUARDRAILS = Object.freeze([
  Object.freeze({ id: 'CHIEF-TRUTH-001', status: 'active', summary: 'Prototype capability must not be described as verified production behavior.' }),
  Object.freeze({ id: 'CHIEF-SECRET-001', status: 'active', summary: 'Privileged keys, private prompt stores, and model calls stay off the browser client.' }),
  Object.freeze({ id: 'CHIEF-IMPORT-001', status: 'active', summary: 'Imported browser state is bounded and structurally validated.' }),
  Object.freeze({ id: 'CHIEF-PROVIDER-001', status: 'active', summary: 'Provider roles stay explicit and replaceable.' }),
  Object.freeze({ id: 'CHIEF-APPROVAL-001', status: 'active', summary: 'The prototype exposes prompt operations, not privileged merge, deploy, billing, or credential actions.' }),
  Object.freeze({ id: 'CHIEF-PROVENANCE-001', status: 'active', summary: 'Browser-local state remains distinguishable from repository and production truth.' })
]);

const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_CUSTOM_PROMPTS = 500;
const MAX_STARS = 5000;
const MAX_TEXT = 20_000;
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function cleanText(value, max = MAX_TEXT) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, max);
}

function sanitizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) return null;
  if (Object.keys(prompt).some(key => BLOCKED_KEYS.has(key))) {
    throw new Error('Import contains a blocked object key.');
  }

  const title = cleanText(prompt.title, 200);
  const body = cleanText(prompt.body, MAX_TEXT);
  if (!title || !body) return null;

  return {
    id: Number.isSafeInteger(prompt.id) ? prompt.id : Date.now(),
    title,
    sub: cleanText(prompt.sub, 500),
    cat: cleanText(prompt.cat, 100) || 'custom',
    platforms: Array.isArray(prompt.platforms)
      ? prompt.platforms.map(value => cleanText(value, 50)).filter(Boolean).slice(0, 12)
      : [],
    body
  };
}

export function validateChiefImportPayload(data, byteLength = 0) {
  if (byteLength > MAX_IMPORT_BYTES) throw new Error('Import exceeds the 1 MiB limit.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Import must be a JSON object.');
  if (Object.keys(data).some(key => BLOCKED_KEYS.has(key))) throw new Error('Import contains a blocked object key.');

  const customSource = data.custom === undefined ? [] : data.custom;
  const starsSource = data.stars === undefined ? [] : data.stars;
  if (!Array.isArray(customSource) || !Array.isArray(starsSource)) {
    throw new Error('Import fields custom and stars must be arrays.');
  }
  if (customSource.length > MAX_CUSTOM_PROMPTS) throw new Error('Import contains too many custom prompts.');
  if (starsSource.length > MAX_STARS) throw new Error('Import contains too many stars.');

  const custom = customSource.map(sanitizePrompt).filter(Boolean);
  const stars = [...new Set(starsSource.filter(Number.isSafeInteger))].slice(0, MAX_STARS);
  return Object.freeze({ custom, stars });
}

export function installChiefGuardrailRuntime() {
  const snapshot = Object.freeze({
    version: '1.0.0',
    vision: CHIEF_AI_VISION,
    guardrails: CHIEF_AI_GUARDRAILS,
    stateScope: 'browser-local',
    privilegedActions: false
  });

  document.documentElement.dataset.guardrails = 'active';
  document.documentElement.dataset.productStage = CHIEF_AI_VISION.stage;
  Object.defineProperty(window, '__CHIEF_AI_GUARDRAILS__', {
    value: snapshot,
    configurable: false,
    enumerable: false,
    writable: false
  });

  const status = document.createElement('div');
  status.id = 'guardrailStatus';
  status.dataset.testid = 'guardrail-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-label', 'Chief AI guardrails active');
  status.textContent = 'Prototype guardrails active';
  Object.assign(status.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0'
  });
  document.body.appendChild(status);

  return snapshot;
}
