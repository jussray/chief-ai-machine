import { classifyRepositoryEvidence } from '../plugins/proofmode/src/audit.js';
import { loadPublicRepositoryEvidence } from '../plugins/proofmode/src/github.js';
import { createProofModeReceipt } from '../plugins/proofmode/src/proof-receipt.js';

const PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOLS = new Set([PROTOCOL_VERSION, '2025-03-26']);
const DEFAULT_DEPS = { loadPublicRepositoryEvidence, classifyRepositoryEvidence };
const RECEIPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOOL_ARGUMENT_KEYS = new Set(['owner', 'repo', 'ref', 'acknowledges']);
const SAFE_TOOL_ERROR_CODES = new Set([
  'repository_unavailable',
  'source_rate_limited',
  'source_forbidden',
  'source_error',
]);

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

function validateProtocolHeader(request) {
  const version = request.headers.get('MCP-Protocol-Version');
  return !version || SUPPORTED_PROTOCOLS.has(version);
}

function validateToolArguments(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'audit_repository arguments must be an object.' };
  }

  if (Object.keys(value).some((key) => !TOOL_ARGUMENT_KEYS.has(key))) {
    return { error: 'audit_repository received unsupported arguments.' };
  }

  const owner = typeof value.owner === 'string' ? value.owner.trim() : '';
  const repo = typeof value.repo === 'string' ? value.repo.trim() : '';
  if (!owner || !repo) {
    return { error: 'audit_repository requires non-empty owner and repo strings.' };
  }

  let ref;
  if (Object.prototype.hasOwnProperty.call(value, 'ref')) {
    ref = typeof value.ref === 'string' ? value.ref.trim() : '';
    if (!ref) return { error: 'audit_repository ref must be a non-empty string when provided.' };
  }

  let acknowledges;
  if (Object.prototype.hasOwnProperty.call(value, 'acknowledges')) {
    if (!Array.isArray(value.acknowledges) || value.acknowledges.length > 50) {
      return { error: 'audit_repository acknowledges must be an array of at most 50 receipt IDs.' };
    }

    const seen = new Set();
    acknowledges = [];
    for (const receiptId of value.acknowledges) {
      if (typeof receiptId !== 'string' || !RECEIPT_ID.test(receiptId)) {
        return { error: 'audit_repository acknowledges contains an invalid receipt ID.' };
      }
      const canonical = receiptId.toLowerCase();
      if (seen.has(canonical)) {
        return { error: 'audit_repository acknowledges must not contain duplicate receipt IDs.' };
      }
      seen.add(canonical);
      acknowledges.push(canonical);
    }
  }

  return {
    args: {
      owner,
      repo,
      ...(ref ? { ref } : {}),
      ...(acknowledges ? { acknowledges } : {}),
    },
  };
}

function toolResult(report, proofReceipt) {
  const structuredContent = { ...report, proofReceipt };
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError: false,
  };
}

function toolError(error) {
  const suppliedCode = typeof error?.code === 'string' ? error.code : '';
  const safeProviderError = SAFE_TOOL_ERROR_CODES.has(suppliedCode);
  const errorCode = safeProviderError ? suppliedCode : 'audit_failed';
  const message = safeProviderError && error instanceof Error
    ? error.message
    : 'ProofMode audit failed without exposing internal details.';
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: { errorCode, message },
    isError: true,
  };
}

function resolveDeps(envOrDeps, maybeDeps) {
  const looksLikeDeps =
    envOrDeps
    && typeof envOrDeps.loadPublicRepositoryEvidence === 'function'
    && typeof envOrDeps.classifyRepositoryEvidence === 'function';

  return looksLikeDeps ? envOrDeps : (maybeDeps || DEFAULT_DEPS);
}

async function dispatch(message, deps) {
  const { id, method, params } = message;

  if (method === 'initialize') {
    const requested = params?.protocolVersion;
    const negotiated = SUPPORTED_PROTOCOLS.has(requested) ? requested : PROTOCOL_VERSION;
    return jsonRpc(id, {
      protocolVersion: negotiated,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'proofmode', title: 'ProofMode', version: '0.1.0' },
      instructions:
        'ProofMode is read-only. It audits public GitHub repository evidence anonymously, emits juss-proof/v1 receipts that can acknowledge upstream provider receipts, and never promotes repository evidence into live runtime verification.',
    });
  }

  if (method === 'ping') return jsonRpc(id, {});

  if (method === 'tools/list') {
    return jsonRpc(id, { tools: [TOOL] });
  }

  if (method === 'tools/call') {
    if (params?.name !== TOOL.name) {
      return jsonRpcError(id, -32602, `Unknown tool: ${params?.name || 'missing'}`);
    }

    const validation = validateToolArguments(params?.arguments ?? {});
    if (validation.error) return jsonRpcError(id, -32602, validation.error);
    const args = validation.args;

    try {
      const evidence = await deps.loadPublicRepositoryEvidence({
        owner: args.owner,
        repo: args.repo,
        ref: args.ref,
      });
      const report = deps.classifyRepositoryEvidence(evidence);
      const proofReceipt = createProofModeReceipt(report, { acknowledges: args.acknowledges });
      return jsonRpc(id, toolResult(report, proofReceipt));
    } catch (error) {
      return jsonRpc(id, toolError(error));
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method || 'missing'}`);
}

export async function handleProofModeMcp(request, envOrDeps = {}, maybeDeps) {
  const deps = resolveDeps(envOrDeps, maybeDeps);

  if (!validateOrigin(request)) {
    return jsonResponse(jsonRpcError(null, -32000, 'Origin not allowed.'), 403);
  }

  if (!validateProtocolHeader(request)) {
    return jsonResponse(jsonRpcError(null, -32600, 'Unsupported MCP-Protocol-Version.'), 400);
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }

  let message;
  try {
    message = await request.json();
  } catch {
    return jsonResponse(jsonRpcError(null, -32700, 'Parse error.'), 400);
  }

  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return jsonResponse(jsonRpcError(message?.id, -32600, 'Invalid Request.'), 400);
  }

  if (message.id === undefined) {
    if (message.method === 'notifications/initialized' || message.method.startsWith('notifications/')) {
      return new Response(null, { status: 202 });
    }
    return new Response(null, { status: 202 });
  }

  return jsonResponse(await dispatch(message, deps));
}
