// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { validateGoalPlan } from './goal-plan.js';

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
const CUSTOM_PROMPT_FIELDS = new Set([
  'id',
  'title',
  'sub',
  'cat',
  'platforms',
  'versions',
  'emoji',
  'notes',
  'repos',
]);
const GOAL_LIST_FIELDS = Object.freeze([
  'evidence',
  'constraints',
  'strategicLenses',
  'capabilities',
  'proofRequirements',
]);

function cleanText(value, maxLength = 10000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanPromptBody(value, maxLength = 50000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function hasPromptBody(value) {
  return typeof value === 'string' && value.trim().length > 0;
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
    const body = cleanPromptBody(rawBody);
    if (!platform || !hasPromptBody(body) || entries.some(([existing]) => existing === platform)) continue;
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function normalizeCustomPrompt(prompt, index = 0) {
  if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) return null;

  const versions = cleanVersions(prompt.versions);
  if (Object.keys(versions).length === 0) return null;

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

function canonicalizeCompatibleCustomPrompt(prompt, index) {
  if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) return null;
  if (Object.keys(prompt).some((key) => !CUSTOM_PROMPT_FIELDS.has(key))) return null;

  const normalized = normalizeCustomPrompt(prompt, index);
  if (!normalized) return null;

  // Identity and founder-authored prose may never be invented, trimmed, truncated, or rewritten.
  if (typeof prompt.id !== 'string' || prompt.id !== normalized.id) return null;
  if (typeof prompt.title !== 'string' || prompt.title !== normalized.title) return null;
  for (const field of ['sub', 'cat', 'emoji', 'notes']) {
    if (prompt[field] !== undefined && prompt[field] !== normalized[field]) return null;
  }

  // Version bodies and keys are authoritative. Any cleanup here would be real data loss.
  if (!prompt.versions || typeof prompt.versions !== 'object' || Array.isArray(prompt.versions)) return null;
  if (stableJson(prompt.versions) !== stableJson(normalized.versions)) return null;

  // App writers historically omitted platforms or stored a subset while versions already
  // carried the extra provider bodies. Deriving the union is non-lossy; rewriting an
  // explicit invalid/duplicate platform is not.
  const explicitPlatforms = prompt.platforms === undefined ? [] : prompt.platforms;
  if (!Array.isArray(explicitPlatforms)) return null;
  const cleanedExplicitPlatforms = explicitPlatforms.map(cleanPlatform);
  if (cleanedExplicitPlatforms.some((platform, platformIndex) => (
    !platform || platform !== explicitPlatforms[platformIndex]
  ))) return null;
  if (new Set(cleanedExplicitPlatforms).size !== cleanedExplicitPlatforms.length) return null;
  const completePlatforms = [...new Set([...cleanedExplicitPlatforms, ...Object.keys(normalized.versions)])];
  if (completePlatforms.length > 12 || stableJson(completePlatforms) !== stableJson(normalized.platforms)) return null;

  // Missing repos means the app had no repo metadata. Existing repo metadata must survive byte-for-byte.
  if (prompt.repos !== undefined && stableJson(prompt.repos) !== stableJson(normalized.repos)) return null;

  return normalized;
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

function requireExportableAssets(assets) {
  if (!Array.isArray(assets)) {
    throw new Error('Portable export blocked: intelligence assets must be an array');
  }

  for (let index = 0; index < assets.length; index += 1) {
    const validation = validateIntelligenceAsset(assets[index]);
    if (!validation.valid) {
      throw new Error(`Portable export blocked: intelligence asset ${index + 1} is invalid (${validation.errors.join('; ')})`);
    }
  }

  return assets;
}

function requireCanonicalCustomPrompts(customPrompts, prefix = 'Portable export blocked') {
  if (!Array.isArray(customPrompts)) {
    throw new Error(`${prefix}: custom prompts must be an array`);
  }
  if (customPrompts.length > 500) {
    throw new Error(`${prefix}: custom prompt state contains invalid or lossy data`);
  }

  const canonical = customPrompts.map((prompt, index) => canonicalizeCompatibleCustomPrompt(prompt, index));
  if (canonical.some((prompt) => !prompt)) {
    throw new Error(`${prefix}: custom prompt state contains invalid or lossy data`);
  }
  return canonical;
}

function requireCanonicalStars(stars, prefix = 'Portable export blocked') {
  if (!Array.isArray(stars)) {
    throw new Error(`${prefix}: stars must be an array`);
  }
  if (stableJson(cleanStars(stars)) !== stableJson(stars)) {
    throw new Error(`${prefix}: star state contains invalid or lossy data`);
  }
  return stars;
}

function requireExportableGoals(goals, prefix = 'Portable export blocked') {
  if (!Array.isArray(goals)) {
    throw new Error(`${prefix}: founder goals must be an array`);
  }
  for (let index = 0; index < goals.length; index += 1) {
    const validation = validateGoalPlan(goals[index]);
    const missingLists = GOAL_LIST_FIELDS.filter((field) => !Array.isArray(goals[index]?.[field]));
    const errors = [...validation.errors, ...missingLists.map((field) => `${field} must be an array`)];
    if (errors.length) {
      throw new Error(`${prefix}: founder goal ${index + 1} is invalid (${errors.join('; ')})`);
    }
  }
  return goals;
}

function readCurrentSnapshotArray(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Import failed: snapshot ${label} must be an array`);
  return value;
}

export function createPortableSnapshot({ assets = [], customPrompts = [], stars = [], goals = [], exportedAt = new Date().toISOString() } = {}) {
  return {
    product: 'chief-ai',
    format: 'founder-intelligence-snapshot',
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    exportedAt,
    assets: requireExportableAssets(assets),
    compatibility: {
      customPrompts: requireCanonicalCustomPrompts(customPrompts),
      stars: requireCanonicalStars(stars),
    },
    goals: requireExportableGoals(goals),
  };
}

export function parsePortableSnapshot(input, now = new Date()) {
  if (!input || typeof input !== 'object') throw new Error('Import failed: snapshot must be an object');

  if (input.format === 'founder-intelligence-snapshot') {
    if (input.schemaVersion !== INTELLIGENCE_SCHEMA_VERSION) throw new Error('Import failed: unsupported snapshot version');
    const assets = readCurrentSnapshotArray(input.assets, 'assets');
    const invalid = assets.find((asset) => !validateIntelligenceAsset(asset).valid);
    if (invalid) throw new Error('Import failed: snapshot contains an invalid intelligence asset');

    const customPrompts = requireCanonicalCustomPrompts(
      readCurrentSnapshotArray(input.compatibility?.customPrompts, 'custom prompts'),
      'Import failed',
    );
    const stars = readCurrentSnapshotArray(input.compatibility?.stars, 'stars');
    requireCanonicalStars(stars, 'Import failed');

    const goals = input.goals === undefined ? null : readCurrentSnapshotArray(input.goals, 'founder goals');
    if (goals !== null) requireExportableGoals(goals, 'Import failed');

    return { assets, customPrompts, stars, goals };
  }

  // Backward compatibility with the original { custom, stars } export.
  const customPrompts = normalizeCustomPrompts(input.custom);
  return {
    assets: customPrompts
      .map((prompt, index) => migrateLegacyPrompt(prompt, new Date(now.getTime() + index))),
    customPrompts,
    stars: cleanStars(input.stars),
    goals: null,
  };
}
