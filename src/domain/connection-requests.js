// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const CONNECTION_REQUEST_CONTRACT = 'juss-v10/fcr-connection-requests@v1';
export const CONNECTION_ENVIRONMENTS = Object.freeze(['development', 'preview', 'production']);

const ENVIRONMENTS = new Set(CONNECTION_ENVIRONMENTS);
const REQUEST_KEYS = new Set(['connectionType', 'environment', 'capabilities']);
const IDENTIFIER = /^[a-z][a-z0-9:_-]{1,79}$/;
const MAX_REQUESTS = 20;
const MAX_CAPABILITIES = 20;

function clean(value, maxLength = 80) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normalizeConnectionRequests(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('connectionRequests must be an array');
  if (value.length > MAX_REQUESTS) throw new Error(`connectionRequests exceeds ${MAX_REQUESTS} entries`);

  const normalized = value.map((request, index) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error(`connectionRequests[${index}] must be an object`);
    }
    const unknownKeys = Object.keys(request).filter((key) => !REQUEST_KEYS.has(key));
    if (unknownKeys.length) {
      throw new Error(`connectionRequests[${index}] contains forbidden fields: ${unknownKeys.sort().join(', ')}`);
    }

    const connectionType = clean(request.connectionType);
    const environment = clean(request.environment);
    if (!IDENTIFIER.test(connectionType)) {
      throw new Error(`connectionRequests[${index}].connectionType is invalid`);
    }
    if (!ENVIRONMENTS.has(environment)) {
      throw new Error(`connectionRequests[${index}].environment must be development, preview, or production`);
    }
    if (!Array.isArray(request.capabilities)) {
      throw new Error(`connectionRequests[${index}].capabilities must be an array`);
    }
    const capabilities = [...new Set(request.capabilities.map((capability) => clean(capability)).filter(Boolean))]
      .sort();
    if (capabilities.length === 0 || capabilities.length > MAX_CAPABILITIES) {
      throw new Error(`connectionRequests[${index}].capabilities must contain 1-${MAX_CAPABILITIES} entries`);
    }
    for (const capability of capabilities) {
      if (!IDENTIFIER.test(capability)) {
        throw new Error(`connectionRequests[${index}] contains invalid capability: ${capability}`);
      }
    }

    return Object.freeze({ connectionType, environment, capabilities: Object.freeze(capabilities) });
  });

  const deduped = new Map();
  for (const request of normalized) {
    const key = `${request.connectionType}:${request.environment}:${request.capabilities.join(',')}`;
    deduped.set(key, request);
  }
  return Object.freeze([...deduped.values()].sort((a, b) => (
    a.connectionType.localeCompare(b.connectionType)
    || a.environment.localeCompare(b.environment)
    || a.capabilities.join(',').localeCompare(b.capabilities.join(','))
  )));
}

export function createConnectionHandoff(value) {
  const connectionRequests = normalizeConnectionRequests(value);
  return Object.freeze({
    contract: CONNECTION_REQUEST_CONTRACT,
    selectedBy: 'chief-ai-machine',
    resolvedBy: 'founder-control-room',
    rawCredentialsAccepted: false,
    rawCredentialsReturned: false,
    resolver: '/mcp/vault/resolve',
    requiresScopedFcrApiToken: true,
    requests: connectionRequests,
  });
}
