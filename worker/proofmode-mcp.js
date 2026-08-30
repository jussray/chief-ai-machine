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
const CLIENT_INFO_META = 'io.modelcontextprotocol/clientInfo';
const SERVER_INFO_META = 'io.modelcontextprotocol/serverInfo';
const SERVER_INFO = { name: 'proofmode', title: 'ProofMode', version: '0.3.0' };
const MAX_BODY_BYTES = 64 * 1024;
const MAX_CONTEXT7_RESPONSE_BYTES = 64 * 1024;
const MAX_DOCUMENTATION_BYTES = 48 * 1024;
const CONTEXT7_MCP_URL = 'https://mcp.context7.com/mcp';

const AUDIT_TOOL = {
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

const DOCUMENTATION_TOOL = {
  name: 'lookup_dependency_docs',
  title: 'Look up dependency documentation',
  description:
    'Fetch current public library documentation from Context7 using an exact Context7 library ID. Documentation is evidence for implementation planning only: it cannot prove repository, runtime, provider, review, merge, deploy, or execution state. Never include secrets, private prompts, personal data, or proprietary code in the query.',
  inputSchema: {
    type: 'object',
    properties: {
      libraryId: {
        type: 'string',
        minLength: 2,
        maxLength: 240,
        pattern: '^/[A-Za-z0-9._@/-]+$',
        description: 'Exact Context7 library ID such as /microsoft/typescript or /supabase/supabase.',
      },
      query: {
        type: 'string',
        minLength: 4,
        maxLength: 1000,
        description: 'One focused public documentation question. Do not include secrets or proprietary source code.',
      },
    },
    required: ['libraryId', 'query'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

const TOOLS = [AUDIT_TOOL, DOCUMENTATION_TOOL];

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

function toolError(error, modern = false, fallback = 'ProofMode tool failed.') {
  const message = error instanceof Error ? error.message : fallback;
  const errorCode = typeof error?.code === 'string' && error.code
    ? error.code
    : 'tool_failed';
  const result = {
    content: [{ type: 'text', text: message }],
    structuredContent: { errorCode, message },
    isError: true,
  };
  return modern ? modernResult(result) : result;
}

function safeError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseSseJson(text) {
  const candidates = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]');

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(candidates[index]);
    } catch {
      // Keep scanning earlier data frames.
    }
  }
  throw safeError('Context7 returned an unreadable MCP response.', 'context7_invalid_response');
}

function context7Text(payload) {
  if (payload?.error) {
    throw safeError('Context7 documentation lookup failed.', 'context7_provider_error');
  }
  const content = payload?.result?.content;
  if (!Array.isArray(content)) {
    throw safeError('Context7 returned no documentation content.', 'context7_empty_response');
  }
  const text = content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim();
  if (!text) {
    throw safeError('Context7 returned no documentation content.', 'context7_empty_response');
  }
  return text;
}

async function queryContext7Documentation({ libraryId, query, apiKey }) {
  const id = `chief-context7-${Date.now()}`;
  const headers = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': MODERN_PROTOCOL_VERSION,
    'Mcp-Method': 'tools/call',
    'Mcp-Name': 'query-docs',
  };
  if (typeof apiKey === 'string' && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  let response;
  try {
    response = await fetch(CONTEXT7_MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name: 'query-docs',
          arguments: { libraryId, query },
          _meta: {
            [PROTOCOL_META]: MODERN_PROTOCOL_VERSION,
            [CLIENT_CAPABILITIES_META]: {},
            [CLIENT_INFO_META]: { name: 'chief-ai-machine', version: SERVER_INFO.version },
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw safeError('Context7 documentation lookup was unavailable.', 'context7_unavailable');
  }

  const raw = await response.text();
  const responseBytes = new TextEncoder().encode(raw).byteLength;
  if (responseBytes > MAX_CONTEXT7_RESPONSE_BYTES) {
    throw safeError('Context7 documentation response exceeded the bounded evidence limit.', 'context7_response_too_large');
  }
  if (!response.ok) {
    throw safeError(`Context7 documentation lookup returned HTTP ${response.status}.`, 'context7_http_error');
  }

  let payload;
  try {
    const contentType = response.headers.get('Content-Type') || '';
    payload = contentType.includes('text/event-stream') ? parseSseJson(raw) : JSON.parse(raw);
  } catch (error) {
    if (error?.code) throw error;
    throw safeError('Context7 returned an unreadable MCP response.', 'context7_invalid_response');
  }

  const documentation = context7Text(payload);
  const encoded = new TextEncoder().encode(documentation);
  if (encoded.byteLength <= MAX_DOCUMENTATION_BYTES) {
    return { documentation, truncated: false };
  }

  const bounded = new TextDecoder().decode(encoded.slice(0, MAX_DOCUMENTATION_BYTES));
  return { documentation: bounded, truncated: true };
}

const DEFAULT_DEPS = {
  loadPublicRepositoryEvidence,
  classifyRepositoryEvidence,
  queryContext7Documentation,
};

function resolveContext(envOrDeps, maybeDeps) {
  const looksLikeDeps =
    envOrDeps
    && typeof envOrDeps.loadPublicRepositoryEvidence === 'function'
    && typeof envOrDeps.classifyRepositoryEvidence === 'function';

  if (looksLikeDeps) return { env: {}, deps: { ...DEFAULT_DEPS, ...envOrDeps } };
  return { env: envOrDeps || {}, deps: { ...DEFAULT_DEPS, ...(maybeDeps || {}) } };
}

function validateAuditArguments(args) {
  if (!isRecord(args)) {
    return jsonRpcError(null, -32602, 'audit_repository arguments must be an object.');
  }
  const allowedKeys = new Set(['owner', 'repo', 'ref', 'acknowledges']);
  const unexpected = Object.keys(args).filter((key) => !allowedKeys.has(key)).sort();
  if (unexpected.length > 0) {
    return jsonRpcError(null, -32602, 'audit_repository contains unexpected arguments.', unexpected);
  }
  if (
    typeof args.owner !== 'string'
    || !args.owner.trim()
    || args.owner.trim().length > 120
    || typeof args.repo !== 'string'
    || !args.repo.trim()
    || args.repo.trim().length > 120
  ) {
    return jsonRpcError(null, -32602, 'audit_repository requires non-empty owner and repo strings.');
  }
  if (args.ref !== undefined && (
    typeof args.ref !== 'string'
    || !args.ref.trim()
    || args.ref.trim().length > 200
  )) {
    return jsonRpcError(null, -32602, 'audit_repository ref must be a non-empty string of at most 200 characters.');
  }
  if (args.acknowledges !== undefined && !Array.isArray(args.acknowledges)) {
    return jsonRpcError(null, -32602, 'audit_repository acknowledges must be an array of receipt IDs.');
  }
  if (Array.isArray(args.acknowledges) && (
    args.acknowledges.length > 50
    || !args.acknowledges.every((value) => typeof value === 'string')
  )) {
    return jsonRpcError(null, -32602, 'audit_repository acknowledges must contain at most 50 receipt ID strings.');
  }
  return null;
}

function validateDocumentationArguments(args) {
  if (!isRecord(args)) {
    return jsonRpcError(null, -32602, 'lookup_dependency_docs arguments must be an object.');
  }
  const allowedKeys = new Set(['libraryId', 'query']);
  const unexpected = Object.keys(args).filter((key) => !allowedKeys.has(key)).sort();
  if (unexpected.length > 0) {
    return jsonRpcError(null, -32602, 'lookup_dependency_docs contains unexpected arguments.', unexpected);
  }
  if (
    typeof args.libraryId !== 'string'
    || !/^\/[A-Za-z0-9._@/-]+$/.test(args.libraryId.trim())
    || args.libraryId.trim().length > 240
  ) {
    return jsonRpcError(null, -32602, 'lookup_dependency_docs requires an exact Context7 libraryId beginning with /.');
  }
  if (
    typeof args.query !== 'string'
    || args.query.trim().length < 4
    || args.query.trim().length > 1000
  ) {
    return jsonRpcError(null, -32602, 'lookup_dependency_docs query must be between 4 and 1000 characters.');
  }
  return null;
}

async function documentationEvidence(args, env, deps) {
  const libraryId = args.libraryId.trim();
  const query = args.query.trim();
  const result = await deps.queryContext7Documentation({
    libraryId,
    query,
    apiKey: typeof env?.CONTEXT7_API_KEY === 'string' ? env.CONTEXT7_API_KEY : undefined,
  });
  const queryFingerprint = await sha256Hex(JSON.stringify({ provider: 'context7', libraryId, query }));
  const contentFingerprint = await sha256Hex(result.documentation);

  return {
    schema: 'chief-documentation-evidence/v1',
    provider: 'context7',
    source: CONTEXT7_MCP_URL,
    libraryId,
    query,
    retrievedAt: new Date().toISOString(),
    queryFingerprint: `sha256:${queryFingerprint}`,
    contentFingerprint: `sha256:${contentFingerprint}`,
    documentation: result.documentation,
    truncated: result.truncated,
    authority: {
      documentationOnly: true,
      actionAuthority: false,
      repositoryVerification: false,
      runtimeVerification: false,
      reviewAuthority: false,
      mergeAuthority: false,
      deployAuthority: false,
    },
    caveat:
      'Context7 documentation may inform implementation and review. It does not prove repository state, runtime behavior, provider state, independent review, or merge/deploy authority.',
  };
}

function documentationToolResult(evidence, modern = false) {
  const result = {
    content: [{ type: 'text', text: JSON.stringify(evidence, null, 2) }],
    structuredContent: evidence,
    isError: false,
  };
  return modern ? modernResult(result) : result;
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
        'ProofMode exposes read-only repository evidence plus Context7 public documentation evidence. Neither tool grants repository, runtime, provider, review, merge, deploy, or execution authority.',
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
        'ProofMode is read-only. Repository audit evidence and Context7 documentation evidence remain non-authorizing inputs and never promote source evidence into live runtime verification.',
    });
  }

  if (!modern && method === 'ping') return jsonRpc(id, {});

  if (method === 'tools/list') {
    const result = { tools: TOOLS };
    return jsonRpc(id, modern
      ? modernResult(result, { ttlMs: 300_000, cacheScope: 'public' })
      : result);
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (toolName === AUDIT_TOOL.name) {
      const validationError = validateAuditArguments(args);
      if (validationError) return { ...validationError, id };

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
        return jsonRpc(id, toolError(error, modern, 'ProofMode audit failed.'));
      }
    }

    if (toolName === DOCUMENTATION_TOOL.name) {
      const validationError = validateDocumentationArguments(args);
      if (validationError) return { ...validationError, id };

      try {
        const evidence = await documentationEvidence(args, env, deps);
        return jsonRpc(id, documentationToolResult(evidence, modern));
      } catch (error) {
        return jsonRpc(id, toolError(error, modern, 'Context7 documentation lookup failed.'));
      }
    }

    return jsonRpcError(id, -32602, `Unknown tool: ${toolName || 'missing'}`);
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
