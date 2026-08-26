// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const INTELLIGENCE_SCHEMA_VERSION = 1;

export const ASSET_KINDS = Object.freeze([
  'prompt',
  'workflow',
  'decision',
  'playbook',
  'benchmark',
  'brand-voice',
  'research',
]);

export const ASSET_STATUSES = Object.freeze([
  'draft',
  'tested',
  'approved',
  'retired',
]);

const KIND_SET = new Set(ASSET_KINDS);
const STATUS_SET = new Set(ASSET_STATUSES);
const CUSTOM_PROMPT_PLATFORM = /^[a-z0-9][a-z0-9._-]{0,39}$/;

function cleanText(value, maxLength = 10000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => cleanText(tag, 60).toLowerCase()).filter(Boolean))].slice(0, 20);
}

function cleanStringList(values, maxItems, maxLength) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanPlatform(value) {
  const platform = cleanText(value, 40).toLowerCase();
  return CUSTOM_PROMPT_PLATFORM.test(platform) ? platform : '';
}

function cleanVersions(versions) {
  if (!versions || typeof versions !== 'object' || Array.isArray(versions)) return {};
  const entries = [];
  for (const [rawPlatform, rawBody] of Object.entries(versions)) {
    const platform = cleanPlatform(rawPlatform);
    const body = cleanText(rawBody, 50000);
    if (!platform || !body || entries.some(([existing]) => existing === platform)) continue;
    entries.push([platform, body]);
    if (entries.length >= 12) break;
  }
  return Object.fromEntries(entries);
}

function cleanStars(stars) {
  if (!Array.isArray(stars)) return [];
  return [...new Set(stars.filter((value) => (
    (typeof value === 'number' && Number.isSafeInteger(value))
    || (typeof value === 'string' && value.length > 0 && value.length <= 180)
  )))].slice(0, 500);
}

export function normalizeCustomPrompt(prompt, index = 0) {
  if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) return null;

  const versions = cleanVersions(prompt.versions);
  const explicitPlatforms = Array.isArray(prompt.platforms)
    ? prompt.platforms.map(cleanPlatform).filter(Boolean)
    : [];
  const platforms = [...new Set([...explicitPlatforms, ...Object.keys(versions)])].slice(0, 12);
  const safeIndex = Number.isSafeInteger(index) && index >= 0 ? index : 0;

  return {
    id: cleanText(prompt.id, 180) || `imported-custom-${safeIndex}`,
    title: cleanText(prompt.title, 160) || 'Imported prompt',
    sub: cleanText(prompt.sub, 500),
    cat: cleanText(prompt.cat, 60).toLowerCase() || 'custom',
    platforms,
    versions,
    emoji: cleanText(prompt.emoji, 16) || '✨',
    notes: cleanText(prompt.notes, 2000),
    repos: cleanStringList(prompt.repos, 20, 120),
  };
}

export function normalizeCustomPrompts(prompts) {
  if (!Array.isArray(prompts)) return [];
  return prompts
    .slice(0, 500)
    .map((prompt, index) => normalizeCustomPrompt(prompt, index))
    .filter(Boolean);
}

function assetId(now, seed = '') {
  const normalizedSeed = cleanText(seed, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `asset-${now.getTime()}-${normalizedSeed || 'intelligence'}`;
}

export function createIntelligenceAsset(input, now = new Date()) {
  const kind = KIND_SET.has(input?.kind) ? input.kind : 'prompt';
  const status = STATUS_SET.has(input?.status) ? input.status : 'draft';
  const title = cleanText(input?.title, 160);
  const content = cleanText(input?.content, 50000);

  if (!title) throw new Error('Asset title is required');
  if (!content) throw new Error('Asset content is required');

  const createdAt = cleanText(input?.createdAt, 40) || now.toISOString();
  const updatedAt = now.toISOString();

  return {
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    id: cleanText(input?.id, 180) || assetId(now, title),
    workspaceId: cleanText(input?.workspaceId, 120) || 'default',
    projectId: cleanText(input?.projectId, 120) || 'general',
    title,
    summary: cleanText(input?.summary, 500),
    kind,
    status,
    content,
    outcome: cleanText(input?.outcome, 2000),
    provider: cleanText(input?.provider, 80) || 'provider-neutral',
    model: cleanText(input?.model, 120),
    tags: cleanTags(input?.tags),
    source: cleanText(input?.source, 500) || 'manual',
    version: Number.isInteger(input?.version) && input.version > 0 ? input.version : 1,
    createdAt,
    updatedAt,
  };
}

export function validateIntelligenceAsset(asset) {
  const errors = [];
  if (!asset || typeof asset !== 'object') return { valid: false, errors: ['Asset must be an object'] };
  if (asset.schemaVersion !== INTELLIGENCE_SCHEMA_VERSION) errors.push('Unsupported schema version');
  if (!cleanText(asset.id, 180)) errors.push('Missing id');
  if (!cleanText(asset.title, 160)) errors.push('Missing title');
  if (!cleanText(asset.content, 50000)) errors.push('Missing content');
  if (!KIND_SET.has(asset.kind)) errors.push('Unsupported kind');
  if (!STATUS_SET.has(asset.status)) errors.push('Unsupported status');
  if (!Array.isArray(asset.tags)) errors.push('Tags must be an array');
  return { valid: errors.length === 0, errors };
}

export function upsertIntelligenceAsset(assets, nextAsset) {
  const validation = validateIntelligenceAsset(nextAsset);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const current = Array.isArray(assets) ? assets : [];
  const existingIndex = current.findIndex((asset) => asset.id === nextAsset.id);
  if (existingIndex === -1) return [...current, nextAsset];

  return current.map((asset, index) => (
    index === existingIndex
      ? { ...nextAsset, version: Math.max(asset.version || 1, nextAsset.version || 1) + 1 }
      : asset
  ));
}

export function migrateLegacyPrompt(prompt, now = new Date()) {
  const platforms = Array.isArray(prompt?.platforms) ? prompt.platforms : [];
  const versions = prompt?.versions && typeof prompt.versions === 'object' ? prompt.versions : {};
  const preferredProvider = platforms[0] || 'provider-neutral';
  const content = cleanText(versions[preferredProvider], 50000)
    || Object.values(versions).find((value) => cleanText(value, 50000))
    || cleanText(prompt?.body, 50000);

  return createIntelligenceAsset({
    id: cleanText(prompt?.id, 180) ? `legacy-${prompt.id}` : undefined,
    title: prompt?.title || 'Imported prompt',
    summary: prompt?.sub || '',
    kind: 'prompt',
    status: 'draft',
    content,
    provider: preferredProvider,
    projectId: Array.isArray(prompt?.repos) && prompt.repos[0] ? prompt.repos[0] : 'general',
    tags: [prompt?.cat, ...platforms].filter(Boolean),
    source: 'legacy-chief-prompt',
  }, now);
}

export function createPortableSnapshot({ assets = [], customPrompts = [], stars = [], exportedAt = new Date().toISOString() } = {}) {
  const safeAssets = assets.filter((asset) => validateIntelligenceAsset(asset).valid);
  return {
    product: 'chief-ai',
    format: 'founder-intelligence-snapshot',
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    exportedAt,
    assets: safeAssets,
    compatibility: {
      customPrompts: normalizeCustomPrompts(customPrompts),
      stars: cleanStars(stars),
    },
  };
}

export function parsePortableSnapshot(input, now = new Date()) {
  if (!input || typeof input !== 'object') throw new Error('Snapshot must be an object');

  if (input.format === 'founder-intelligence-snapshot') {
    if (input.schemaVersion !== INTELLIGENCE_SCHEMA_VERSION) throw new Error('Unsupported snapshot version');
    const assets = Array.isArray(input.assets) ? input.assets : [];
    const invalid = assets.find((asset) => !validateIntelligenceAsset(asset).valid);
    if (invalid) throw new Error('Snapshot contains an invalid intelligence asset');
    return {
      assets,
      customPrompts: normalizeCustomPrompts(input.compatibility?.customPrompts),
      stars: cleanStars(input.compatibility?.stars),
    };
  }

  // Backward compatibility with the original { custom, stars } export.
  const customPrompts = normalizeCustomPrompts(input.custom);
  return {
    assets: customPrompts
      .filter((prompt) => Object.values(prompt.versions).some(Boolean))
      .map((prompt, index) => migrateLegacyPrompt(prompt, new Date(now.getTime() + index))),
    customPrompts,
    stars: cleanStars(input.stars),
  };
}