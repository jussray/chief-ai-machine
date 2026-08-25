import { classifyRepositoryEvidence } from '../plugins/proofmode/src/audit.js';
import { loadPublicRepositoryEvidence } from '../plugins/proofmode/src/github.js';
import { createProofModeReceipt } from '../plugins/proofmode/src/proof-receipt.js';

const MODERN_PROTOCOL_VERSION = '2026-07-28';
const PROTOCOL_VERSION = '2025-11-25';
const LEGACY_PROTOCOLS = [PROTOCOL_VERSION, '2025-06-18', '2025-03-26'];
const SUPPORTED_PROTOCOLS = new Set([MODERN_PROTOCOL_VERSION, ...LEGACY_PROTOCOLS]);
const SUPPORTED_PROTOCOL_LIST = [MODERN_PROTOCOL_VERSION, ...LEGACY_PROTOCOLS];
const PROTOCOL_META = 'io.modelcontextprotocol/protocolVersion';
const CLIENT_CAPABILITIES_META = 'io.modelcontextprotocol/clientCapabilities';
const SERVER_INFO_META = 'io.modelcontextprotocol/serverInfo';
const SERVER_INFO = { name: 'proofmode', title: 'ProofMode', version: '0.2.0' };
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_DEPS = { loadPublicRepositoryEvidence, classifyRepositoryEvidence };

const TOOL = {
  name: 'audit_repository',
  title: 'Audit repository evidence',
  description:
    'Read public GitHub repository evidence and classify what is claimed, implemented, tested, deployed, and independently verified. Emits a juss-proof/v1 receipt and remains read-only.',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', minLength: 1, description: 'GitHub repository owner.' },
      repo: { type: 'string', minLength: 1, description: 'GitHub repository name.' },
      ref: { type: 'string', minLength: 1, description: 'Optional branch, tag, or commit SHA.' },
      acknowledges: {
        type: 'array',
        maxItems: 50,
        uniqueItems: true,
        description: 'Optional upstream juss-proof/v1 receipt IDs this audit explicitly acknowledges.',
        items: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },
      },
    },
    required: ['owner', 'repo'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

function jsonRpc(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function validateOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requestMeta(message) {
  return isRecord(message?.params) && isRecord(message.params._meta)
    ? message.params._meta
    : null;
}

function protocolForRequest(request, message) {
  const metaVersion = requestMeta(message)?.[PROTOCOL_META];
  if (typeof metaVersion === 'string') return metaVersion;
  const headerVersion = request.headers.get('MCP-Protocol-Version');
  if (headerVersion) return headerVersion;
  if (message?.method === 'initialize') return message.params?.protocolVersion || null;
  return null;
}

function decodeHeaderValue(value) {
  if (!value.startsWith('=?base64?') || !value.endsWith('?=')) return value;
  try {
    const bytes = Uint8Array.from(atob(value.slice('=?base64?'.length, -2)), (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function validateModernRequest(request, message) {
  const meta = requestMeta(message);
  if (
    request.headers.get('MCP-Protocol-Version') !== MODERN_PROTOCOL_VERSION
    || meta?.[PROTOCOL_META] !== MODERN_PROTOCOL_VERSION
  ) {
    return jsonRpcError(message?.id, -32020, 'Header mismatch: MCP protocol version is missing or inconsistent.');
  }
  if (!isRecord(meta?.[CLIENT_CAPABILITIES_META])) {
    return jsonRpcError(message?.id, -32600, 'Modern MCP requests require client capabilities in _meta.');
  }
  if (request.headers.get('Mcp-Method') !== message.method) {
    return jsonRpcError(message?.id, -32020, 'Header mismatch: Mcp-Method does not match the request body.');
  }
  if (message.method === 'tools/call') {
    const headerName = request.headers.get('Mcp-Name');
    if (!headerName || decodeHeaderValue(headerName) !== message.params?.name) {
      return jsonRpcError(message?.id, -32020, 'Header mismatch: Mcp-Name does not match the request body.');
    }
  }
  return null;
}

function modernResult(value, cache) {
  return {
    resultType: 'complete',
    ...value,
    ...(cache || {}),
    _meta: {
      ...(isRecord(value?._meta) ? value._meta : {}),
      [SERVER_INFO_META]: SERVER_INFO,
    },
  };
}

function toolResult(report, proofReceipt, modern = false) {
  const structuredContent = { ...report, proofReceipt };
  const result = {
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError: false,
  };
  return modern ? modernResult(result) : result;
}

function toolError(error, modern = false) {
  const message = error instanceof Error ? error.message : 'ProofMode audit failed.';
  const errorCode = typeof error?.code === 'string' && error.code
    ? error.code
    : 'audit_failed';
  const result = {
    content: [{ type: 'text', text: message }],
    structuredContent: { errorCode, message },
    isError: true,
  };
  return modern ? modernResult(result) : result;
}

function resolveContext(envOrDeps, maybeDeps) {
  const looksLikeDeps =
    envOrDeps
    && typeof envOrDeps.loadPublicRepositoryEvidence === 'function'
    && typeof envOrDeps.classifyRepositoryEvidence === 'function';

  if (looksLikeDeps) return { env: {}, deps: envOrDeps };
  return { env: envOrDeps || {}, deps: maybeDeps || DEFAULT_DEPS };
}

async function dispatch(message, deps, env, protocol) {
  const { id, method, params } = message;
  const modern = protocol === MODERN_PROTOCOL_VERSION;

  if (method === 'server/discover') {
    if (!modern) return jsonRpcError(id, -32601, 'server/discover requires MCP 2026-07-28.');
    return jsonRpc(id, modernResult({
      supportedVersions: SUPPORTED_PROTOCOL_LIST,
      capabilities: { tools: {} },
      instructions:
        'ProofMode is a public, read-only repository evidence auditor. It emits juss-proof/v1 receipts, stores no caller credentials, and never grants repository or runtime mutation authority.',
    }, { ttlMs: 300_000, cacheScope: 'public' }));
  }

  if (method === 'initialize') {
    if (modern) return jsonRpcError(id, -32601, 'initialize is not part of MCP 2026-07-28.');
    const requested = params?.protocolVersion;
    const negotiated = LEGACY_PROTOCOLS.includes(requested) ? requested : PROTOCOL_VERSION;
    return jsonRpc(id, {
      protocolVersion: negotiated,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions:
        'ProofMode is read-only. It audits public GitHub repository evidence, emits juss-proof/v1 receipts that can acknowledge upstream provider receipts, and never promotes repository evidence into live runtime verification.',
    });
  }

  if (!modern && method === 'ping') return jsonRpc(id, {});

  if (method === 'tools/list') {
    const result = { tools: [TOOL] };
    return jsonRpc(id, modern
      ? modernResult(result, { ttlMs: 300_000, cacheScope: 'public' })
      : result);
  }

  if (method === 'tools/call') {
    if (params?.name !== TOOL.name) {
      return jsonRpcError(id, -32602, `Unknown tool: ${params?.name || 'missing'}`);
    }

    const args = params?.arguments || {};
    if (!isRecord(args)) {
      return jsonRpcError(id, -32602, 'audit_repository arguments must be an object.');
    }
    const allowedKeys = new Set(['owner', 'repo', 'ref', 'acknowledges']);
    const unexpected = Object.keys(args).filter((key) => !allowedKeys.has(key)).sort();
    if (unexpected.length > 0) {
      return jsonRpcError(id, -32602, 'audit_repository contains unexpected arguments.', unexpected);
    }
    if (
      typeof args.owner !== 'string'
      || !args.owner.trim()
      || args.owner.trim().length > 120
      || typeof args.repo !== 'string'
      || !args.repo.trim()
      || args.repo.trim().length > 120
    ) {
      return jsonRpcError(id, -32602, 'audit_repository requires non-empty owner and repo strings.');
    }
    if (args.ref !== undefined && (
      typeof args.ref !== 'string'
      || !args.ref.trim()
      || args.ref.trim().length > 200
    )) {
      return jsonRpcError(id, -32602, 'audit_repository ref must be a non-empty string of at most 200 characters.');
    }
    if (args.acknowledges !== undefined && !Array.isArray(args.acknowledges)) {
      return jsonRpcError(id, -32602, 'audit_repository acknowledges must be an array of receipt IDs.');
    }
    if (Array.isArray(args.acknowledges) && (
      args.acknowledges.length > 50
      || !args.acknowledges.every((value) => typeof value === 'string')
    )) {
      return jsonRpcError(id, -32602, 'audit_repository acknowledges must contain at most 50 receipt ID strings.');
    }

    try {
      const evidence = await deps.loadPublicRepositoryEvidence({
        owner: args.owner.trim(),
        repo: args.repo.trim(),
        ref: typeof args.ref === 'string' ? args.ref.trim() : undefined,
        token: typeof env?.PROOFMODE_GITHUB_TOKEN === 'string'
          ? env.PROOFMODE_GITHUB_TOKEN
          : undefined,
      });
      const report = deps.classifyRepositoryEvidence(evidence);
      const proofReceipt = createProofModeReceipt(report, { acknowledges: args.acknowledges });
      return jsonRpc(id, toolResult(report, proofReceipt, modern));
    } catch (error) {
      return jsonRpc(id, toolError(error, modern));
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method || 'missing'}`);
}

export async function handleProofModeMcp(request, envOrDeps = {}, maybeDeps) {
  const { env, deps } = resolveContext(envOrDeps, maybeDeps);

  if (!validateOrigin(request)) {
    return jsonResponse(jsonRpcError(null, -32000, 'Origin not allowed.'), 403);
  }

  if (request.method === 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return jsonResponse(jsonRpcError(null, -32600, 'Content-Type must be application/json.'), 415);
  }

  let message;
  try {
    const raw = await request.text();
    if (new globalThis.TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return jsonResponse(jsonRpcError(null, -32600, 'MCP request exceeds the 64 KiB limit.'), 413);
    }
    message = JSON.parse(raw);
  } catch {
    return jsonResponse(jsonRpcError(null, -32700, 'Parse error.'), 400);
  }

  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return jsonResponse(jsonRpcError(message?.id, -32600, 'Invalid Request.'), 400);
  }

  const protocol = protocolForRequest(request, message);
  if (protocol && !SUPPORTED_PROTOCOLS.has(protocol)) {
    return jsonResponse(jsonRpcError(message.id, -32022, 'Unsupported protocol version.', {
      supported: SUPPORTED_PROTOCOL_LIST,
      requested: protocol,
    }), 400);
  }

  const modern = protocol === MODERN_PROTOCOL_VERSION;
  if (modern) {
    const headerError = validateModernRequest(request, message);
    if (headerError) return jsonResponse(headerError, 400);
    const accept = request.headers.get('Accept') || '';
    if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
      return jsonResponse(
        jsonRpcError(message.id, -32600, 'Accept must include application/json and text/event-stream.'),
        406,
      );
    }
    if (message.id === null) {
      return jsonResponse(jsonRpcError(null, -32600, 'Modern MCP request IDs cannot be null.'), 400);
    }
  }

  if (message.id === undefined) {
    if (message.method === 'notifications/initialized' || message.method.startsWith('notifications/')) {
      return new Response(null, { status: 202 });
    }
    return new Response(null, { status: 202 });
  }

  const response = await dispatch(message, deps, env, protocol);
  const status = response.error?.code === -32601 ? 404 : 200;
  return jsonResponse(response, status);
}
