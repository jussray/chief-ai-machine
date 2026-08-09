// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const CAPABILITY_PLAN_CONTRACT = 'juss-v10/capability-plan@v1';
export const CAPABILITY_PLAN_SELECTOR = 'chief-ai-machine';

export const CAPABILITY_ORIGINS = Object.freeze([
  'founder-native',
  'repo-native',
  'generated',
  'provider',
  'community',
  'vendor',
]);

export const CAPABILITY_AUTHORITY_LEVELS = Object.freeze([
  'reason',
  'draft',
  'reversible',
  'privileged',
]);

const ORIGIN_SET = new Set(CAPABILITY_ORIGINS);
const AUTHORITY_SET = new Set(CAPABILITY_AUTHORITY_LEVELS);
const AUTHORITY_RANK = new Map(CAPABILITY_AUTHORITY_LEVELS.map((value, index) => [value, index]));
const ORIGIN_AUTHORITY_CEILING = Object.freeze({
  'founder-native': 'privileged',
  'repo-native': 'privileged',
  generated: 'draft',
  provider: 'draft',
  community: 'draft',
  vendor: 'draft',
});

const FULL_SHA = /^[0-9a-f]{40}$/i;
const HASH = /^[0-9a-f]{64}$/i;
const SHA256_K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function cleanText(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringList(values, maxItems = 30, maxLength = 500) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))]
    .sort()
    .slice(0, maxItems);
}

function normalizeCapability(capability) {
  return {
    id: cleanText(capability?.id, 160),
    version: cleanText(capability?.version, 80),
    origin: cleanText(capability?.origin, 40),
    owner: cleanText(capability?.owner, 160),
    sourceHash: cleanText(capability?.sourceHash, 64).toLowerCase(),
    authorityCeiling: cleanText(capability?.authorityCeiling, 40),
  };
}

function normalizedCapabilities(values) {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeCapability).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 30);
}

function authorityAllows(requested, ceiling) {
  const requestedRank = AUTHORITY_RANK.get(requested);
  const ceilingRank = AUTHORITY_RANK.get(ceiling);
  return requestedRank !== undefined && ceilingRank !== undefined && requestedRank <= ceilingRank;
}

function utf8Bytes(value) {
  const bytes = [];
  for (const symbol of value) {
    const codePoint = symbol.codePointAt(0);
    if (codePoint <= 0x7f) bytes.push(codePoint);
    else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

function rotateRight(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

export function sha256Hex(value) {
  const bytes = utf8Bytes(String(value));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Array(64).fill(0);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + index * 4;
      words[index] = (
        (bytes[cursor] << 24)
        | (bytes[cursor + 1] << 16)
        | (bytes[cursor + 2] << 8)
        | bytes[cursor + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15];
      const b = words[index - 2];
      const s0 = (rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3)) >>> 0;
      const s1 = (rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10)) >>> 0;
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
      const choice = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + sigma1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const sigma0 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (sigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
}

function capabilityPlanSeed(plan) {
  return JSON.stringify([
    plan.contract,
    plan.selectedBy,
    plan.goal,
    plan.projectSlug,
    plan.expectedHeadSha,
    plan.registryHash,
    plan.requestedAuthority,
    plan.strategicLenses,
    plan.routingReason,
    plan.capabilities.map((capability) => [
      capability.id,
      capability.version,
      capability.origin,
      capability.owner,
      capability.sourceHash,
      capability.authorityCeiling,
    ]),
    plan.proofRequirements,
    plan.outcomeSignals,
    plan.rollback,
  ]);
}

export function capabilityPlanHash(plan) {
  return sha256Hex(capabilityPlanSeed(plan));
}

export function validateCapabilityPlan(plan) {
  const errors = [];

  if (!plan || typeof plan !== 'object') return { valid: false, errors: ['Capability plan must be an object'] };
  if (plan.contract !== CAPABILITY_PLAN_CONTRACT) errors.push('Unsupported capability plan contract');
  if (plan.selectedBy !== CAPABILITY_PLAN_SELECTOR) errors.push('Capability selection must be owned by Chief AI Machine');
  if (!cleanText(plan.goal)) errors.push('Capability plan goal is required');
  if (!cleanText(plan.projectSlug, 160)) errors.push('Capability plan projectSlug is required');
  if (!FULL_SHA.test(cleanText(plan.expectedHeadSha, 40))) errors.push('Capability plan expectedHeadSha must be a full Git SHA');
  if (!HASH.test(cleanText(plan.registryHash, 64))) errors.push('Capability plan registryHash must be sha256');
  if (!AUTHORITY_SET.has(plan.requestedAuthority)) errors.push('Unsupported requested authority');
  if (!cleanText(plan.routingReason, 2000)) errors.push('Capability plan routing reason is required');
  if (!cleanText(plan.rollback, 2000)) errors.push('Capability plan rollback is required');
  if (!Array.isArray(plan.strategicLenses) || plan.strategicLenses.length === 0) errors.push('Capability plan strategic lenses are required');
  if (!Array.isArray(plan.proofRequirements) || plan.proofRequirements.length === 0) errors.push('Capability plan proof requirements are required');
  if (!Array.isArray(plan.outcomeSignals) || plan.outcomeSignals.length === 0) errors.push('Capability plan outcome signals are required');

  if (!Array.isArray(plan.capabilities) || plan.capabilities.length === 0) {
    errors.push('Capability plan requires at least one capability');
  } else if (plan.capabilities.length > 30) {
    errors.push('Capability plan exceeds the capability limit');
  } else {
    const ids = new Set();
    for (const capability of plan.capabilities) {
      if (!cleanText(capability?.id, 160)) errors.push('Capability id is required');
      if (!cleanText(capability?.version, 80)) errors.push(`Capability ${capability?.id || '<unknown>'} version is required`);
      if (!ORIGIN_SET.has(capability?.origin)) errors.push(`Capability ${capability?.id || '<unknown>'} has unsupported origin`);
      if (!cleanText(capability?.owner, 160)) errors.push(`Capability ${capability?.id || '<unknown>'} owner is required`);
      if (!HASH.test(cleanText(capability?.sourceHash, 64))) errors.push(`Capability ${capability?.id || '<unknown>'} sourceHash must be sha256`);
      if (!AUTHORITY_SET.has(capability?.authorityCeiling)) errors.push(`Capability ${capability?.id || '<unknown>'} has unsupported authority ceiling`);
      if (ids.has(capability?.id)) errors.push(`Duplicate capability id: ${capability?.id}`);
      ids.add(capability?.id);

      if (ORIGIN_SET.has(capability?.origin) && AUTHORITY_SET.has(capability?.authorityCeiling)) {
        const originCeiling = ORIGIN_AUTHORITY_CEILING[capability.origin];
        if (!authorityAllows(capability.authorityCeiling, originCeiling)) errors.push(`Capability ${capability.id} authority exceeds its ${capability.origin} origin ceiling`);
      }
      if (AUTHORITY_SET.has(plan.requestedAuthority) && AUTHORITY_SET.has(capability?.authorityCeiling)) {
        if (!authorityAllows(plan.requestedAuthority, capability.authorityCeiling)) errors.push(`Capability ${capability.id} cannot satisfy requested authority ${plan.requestedAuthority}`);
      }
    }
  }

  if (!HASH.test(cleanText(plan.planHash, 64))) errors.push('Capability plan hash must be sha256');
  else if (capabilityPlanHash(plan) !== plan.planHash.toLowerCase()) errors.push('Capability plan hash does not match plan content');

  return { valid: errors.length === 0, errors };
}

export function createCapabilityPlan(input) {
  const plan = {
    contract: CAPABILITY_PLAN_CONTRACT,
    selectedBy: CAPABILITY_PLAN_SELECTOR,
    goal: cleanText(input?.goal),
    projectSlug: cleanText(input?.projectSlug, 160),
    expectedHeadSha: cleanText(input?.expectedHeadSha, 40).toLowerCase(),
    registryHash: cleanText(input?.registryHash, 64).toLowerCase(),
    requestedAuthority: AUTHORITY_SET.has(input?.requestedAuthority) ? input.requestedAuthority : 'reason',
    strategicLenses: cleanStringList(input?.strategicLenses, 20, 120),
    routingReason: cleanText(input?.routingReason, 2000),
    capabilities: normalizedCapabilities(input?.capabilities),
    proofRequirements: cleanStringList(input?.proofRequirements, 30, 500),
    outcomeSignals: cleanStringList(input?.outcomeSignals, 30, 500),
    rollback: cleanText(input?.rollback, 2000),
  };

  const withHash = { ...plan, planHash: capabilityPlanHash(plan) };
  const validation = validateCapabilityPlan(withHash);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return withHash;
}
