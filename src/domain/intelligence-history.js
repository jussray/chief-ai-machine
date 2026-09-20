// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import {
  createPortableSnapshot as createBasePortableSnapshot,
  parsePortableSnapshot as parseBasePortableSnapshot,
  validateIntelligenceAsset as validateBaseIntelligenceAsset,
} from './intelligence.js';

function cloneHistoricalSnapshot(asset) {
  const { history, historyComplete, ...snapshot } = asset || {};
  return {
    ...snapshot,
    tags: Array.isArray(snapshot.tags) ? [...snapshot.tags] : snapshot.tags,
  };
}

function historyValidation(asset) {
  const errors = [];
  const base = validateBaseIntelligenceAsset(asset);
  errors.push(...base.errors);
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return errors;

  const hasHistory = Object.hasOwn(asset, 'history');
  const hasHistoryComplete = Object.hasOwn(asset, 'historyComplete');
  if (!hasHistory && !hasHistoryComplete) return errors;

  if (!Array.isArray(asset.history)) {
    errors.push('Version history must be an array');
    return errors;
  }
  if (typeof asset.historyComplete !== 'boolean') {
    errors.push('Version history completeness must be explicit');
  }

  const currentVersion = Number.isInteger(asset.version) && asset.version > 0 ? asset.version : null;
  if (currentVersion === null) errors.push('Current version must be a positive integer');

  let previousVersion = 0;
  for (let index = 0; index < asset.history.length; index += 1) {
    const snapshot = asset.history[index];
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      errors.push(`Version history entry ${index + 1} must be an object`);
      continue;
    }
    if (Object.hasOwn(snapshot, 'history') || Object.hasOwn(snapshot, 'historyComplete')) {
      errors.push(`Version history entry ${index + 1} must not contain nested history`);
    }
    const validation = validateBaseIntelligenceAsset(snapshot);
    if (!validation.valid) {
      errors.push(`Version history entry ${index + 1} is invalid (${validation.errors.join('; ')})`);
    }
    if (snapshot.id !== asset.id) errors.push(`Version history entry ${index + 1} has a different asset id`);
    if (!Number.isInteger(snapshot.version) || snapshot.version <= 0) {
      errors.push(`Version history entry ${index + 1} has an invalid version`);
      continue;
    }
    if (snapshot.version <= previousVersion) {
      errors.push('Version history must be strictly increasing');
    }
    if (currentVersion !== null && snapshot.version >= currentVersion) {
      errors.push('Version history entries must precede the current version');
    }
    previousVersion = snapshot.version;
  }

  if (asset.historyComplete === true && currentVersion !== null) {
    if (asset.history.length !== Math.max(0, currentVersion - 1)) {
      errors.push('Complete version history must contain every prior version');
    } else {
      for (let index = 0; index < asset.history.length; index += 1) {
        if (asset.history[index]?.version !== index + 1) {
          errors.push('Complete version history must begin at version 1 without gaps');
          break;
        }
      }
    }
  }

  return errors;
}

export function validateIntelligenceAsset(asset) {
  const errors = historyValidation(asset);
  return { valid: errors.length === 0, errors };
}

export function upsertIntelligenceAsset(assets, nextAsset) {
  if (nextAsset && (Object.hasOwn(nextAsset, 'history') || Object.hasOwn(nextAsset, 'historyComplete'))) {
    throw new Error('Version history is managed by Company Brain and cannot be rewritten by an update payload');
  }

  const nextValidation = validateBaseIntelligenceAsset(nextAsset);
  if (!nextValidation.valid) throw new Error(nextValidation.errors.join('; '));

  const current = Array.isArray(assets) ? assets : [];
  const existingIndex = current.findIndex((asset) => asset.id === nextAsset.id);
  if (existingIndex === -1) {
    const initial = {
      ...nextAsset,
      history: [],
      historyComplete: nextAsset.version === 1,
    };
    const validation = validateIntelligenceAsset(initial);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    return [...current, initial];
  }

  const existing = current[existingIndex];
  const existingValidation = validateIntelligenceAsset(existing);
  if (!existingValidation.valid) {
    throw new Error(`Existing version history is invalid (${existingValidation.errors.join('; ')})`);
  }

  const currentVersion = Number.isInteger(existing.version) && existing.version > 0 ? existing.version : 1;
  const previousHistory = Array.isArray(existing.history)
    ? existing.history.map((snapshot) => cloneHistoricalSnapshot(snapshot))
    : [];
  const historyWasComplete = existing.historyComplete === true
    || (!Object.hasOwn(existing, 'history') && currentVersion === 1);

  const updated = {
    ...nextAsset,
    version: currentVersion + 1,
    history: [...previousHistory, cloneHistoricalSnapshot(existing)],
    historyComplete: historyWasComplete,
  };
  const validation = validateIntelligenceAsset(updated);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  return current.map((asset, index) => (index === existingIndex ? updated : asset));
}

function requireVersionedAssets(assets, prefix) {
  if (!Array.isArray(assets)) throw new Error(`${prefix}: intelligence assets must be an array`);
  for (let index = 0; index < assets.length; index += 1) {
    const validation = validateIntelligenceAsset(assets[index]);
    if (!validation.valid) {
      throw new Error(`${prefix}: intelligence asset ${index + 1} has invalid version history (${validation.errors.join('; ')})`);
    }
  }
  return assets;
}

export function createPortableSnapshot(input = {}) {
  requireVersionedAssets(input.assets ?? [], 'Portable export blocked');
  return createBasePortableSnapshot(input);
}

export function parsePortableSnapshot(input, now = new Date()) {
  const parsed = parseBasePortableSnapshot(input, now);
  requireVersionedAssets(parsed.assets, 'Import failed');
  return parsed;
}
