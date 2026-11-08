import { classifyRepositoryEvidence } from '../plugins/proofmode/src/audit.js';
import { loadPublicRepositoryEvidence } from '../plugins/proofmode/src/github.js';
import { createProofModeReceipt } from '../plugins/proofmode/src/proof-receipt.js';

const PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOLS = new Set([PROTOCOL_VERSION, '2025-03-26']);
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

function toolResult(report, proofReceipt) {
  const structuredContent = { ...report, proofReceipt };
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError: false,
  };
}

function toolError(error) {
  const message = error instanceof Error ? error.message : 'ProofMode audit failed.';
  const errorCode = typeof error?.code === 'string' && error.code
    ? error.code
    : 'audit_failed';
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: { errorCode, message },
    isError: true,
  };
}

function resolveContext(envOrDeps, maybeDeps) {
  const looksLikeDeps =
    envOrDeps
    && typeof envOrDeps.loadPublicRepositoryEvidence === 'function'
    && typeof envOrDeps.classifyRepositoryEvidence === 'function';

  if (looksLikeDeps) return { env: {}, deps: envOrDeps };
  return { env: envOrDeps || {}, deps: maybeDeps || DEFAULT_DEPS };
}

async function dispatch(message, deps, env) {
  const { id, method, params } = message;

  if (method === 'initialize') {
    const requested = params?.protocolVersion;
    const negotiated = SUPPORTED_PROTOCOLS.has(requested) ? requested : PROTOCOL_VERSION;
    return jsonRpc(id, {
      protocolVersion: negotiated,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'proofmode', title: 'ProofMode', version: '0.1.0' },
      instructions:
        'ProofMode is read-only. It audits public GitHub repository evidence, emits juss-proof/v1 receipts that can acknowledge upstream provider receipts, and never promotes repository evidence into live runtime verification.',
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

    const args = params?.arguments || {};
    if (typeof args.owner !== 'string' || !args.owner.trim() || typeof args.repo !== 'string' || !args.repo.trim()) {
      return jsonRpcError(id, -32602, 'audit_repository requires non-empty owner and repo strings.');
    }
    if (args.acknowledges !== undefined && !Array.isArray(args.acknowledges)) {
      return jsonRpcError(id, -32602, 'audit_repository acknowledges must be an array of receipt IDs.');
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
      return jsonRpc(id, toolResult(report, proofReceipt));
    } catch (error) {
      return jsonRpc(id, toolError(error));
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method || 'missing'}`);
}

export async function handleProofModeMcp(request, envOrDeps = {}, maybeDeps) {
  const { env, deps } = resolveContext(envOrDeps, maybeDeps);

  if (!validateOrigin(request)) {
    return jsonResponse(jsonRpcError(null, -32000, 'Origin not allowed.'), 403);
  }

  if (!validateProtocolHeader(request)) {
    return jsonResponse(jsonRpcError(null, -32600, 'Unsupported MCP-Protocol-Version.'), 400);
  }

  if (request.method === 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'POST, GET' } });
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST, GET' } });
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

  return jsonResponse(await dispatch(message, deps, env));
}
