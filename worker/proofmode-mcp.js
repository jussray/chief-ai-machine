import { classifyRepositoryEvidence } from '../plugins/proofmode/src/audit.js';
import { loadPublicRepositoryEvidence, ProofModeGitHubError } from '../plugins/proofmode/src/github.js';
import { createProofModeReceipt } from '../plugins/proofmode/src/proof-receipt.js';

const MODERN_PROTOCOL_VERSION = '2026-07-28';
const LEGACY_PROTOCOL_VERSION = '2025-06-18';
const LEGACY_PROTOCOLS = new Set([LEGACY_PROTOCOL_VERSION, '2025-03-26']);
const SUPPORTED_PROTOCOLS = Object.freeze([
  MODERN_PROTOCOL_VERSION,
  LEGACY_PROTOCOL_VERSION,
  '2025-03-26',
]);
const SUPPORTED_PROTOCOL_SET = new Set(SUPPORTED_PROTOCOLS);
const DEFAULT_DEPS = { loadPublicRepositoryEvidence, classifyRepositoryEvidence };
const RECEIPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOOL_ARGUMENT_KEYS = new Set(['owner', 'repo', 'ref', 'acknowledges']);
const MODERN_PROTOCOL_META_KEY = 'io.modelcontextprotocol/protocolVersion';
const MODERN_CLIENT_INFO_META_KEY = 'io.modelcontextprotocol/clientInfo';
const MODERN_CLIENT_CAPABILITIES_META_KEY = 'io.modelcontextprotocol/clientCapabilities';
const MODERN_SERVER_INFO_META_KEY = 'io.modelcontextprotocol/serverInfo';
const SERVER_INFO = Object.freeze({ name: 'proofmode', title: 'ProofMode', version: '0.1.0' });
const SERVER_CAPABILITIES = Object.freeze({ tools: Object.freeze({ listChanged: false }) });
const SERVER_INSTRUCTIONS =
  'ProofMode is read-only. It audits public GitHub repository evidence anonymously, emits juss-proof/v1 receipts that can acknowledge upstream provider receipts, and never promotes repository evidence into live runtime verification.';
const SAFE_TOOL_ERROR_MESSAGES = Object.freeze({
  repository_unavailable: 'Repository or ref is not publicly available to ProofMode.',
  source_rate_limited: 'GitHub rate-limited the public evidence request.',
  source_forbidden: 'GitHub refused the anonymous public evidence request.',
  source_error: 'GitHub public evidence request failed.',
});

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

function modernResult(result) {
  const currentMeta = result && typeof result._meta === 'object' && !Array.isArray(result._meta)
    ? result._meta
    : {};
  return {
    ...result,
    resultType: 'complete',
    _meta: {
      ...currentMeta,
      [MODERN_SERVER_INFO_META_KEY]: SERVER_INFO,
    },
  };
}

function jsonRpc(id, result, protocolVersion = LEGACY_PROTOCOL_VERSION) {
  return {
    jsonrpc: '2.0',
    id,
    result: protocolVersion === MODERN_PROTOCOL_VERSION ? modernResult(result) : result,
  };
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

function classifyProtocol(request) {
  const version = request.headers.get('MCP-Protocol-Version');
  if (!version) return { protocolVersion: LEGACY_PROTOCOL_VERSION, explicit: false };
  if (!SUPPORTED_PROTOCOL_SET.has(version)) {
    return {
      error: jsonRpcError(null, -32022, 'Unsupported MCP protocol version.', {
        supportedProtocolVersions: SUPPORTED_PROTOCOLS,
      }),
    };
  }
  return { protocolVersion: version, explicit: true };
}

function modernHeaderMismatch(message, detail) {
  return jsonRpcError(message?.id, -32020, 'MCP routing headers do not match the request body.', { detail });
}

function validateModernEnvelope(request, message) {
  const methodHeader = request.headers.get('Mcp-Method');
  if (!methodHeader || methodHeader !== message.method) {
    return modernHeaderMismatch(message, 'Mcp-Method must be present and equal the JSON-RPC method.');
  }

  const expectedName = message.method === 'tools/call'
    ? (typeof message.params?.name === 'string' ? message.params.name : '')
    : '';
  const nameHeader = request.headers.get('Mcp-Name');
  if (expectedName) {
    if (!nameHeader || nameHeader !== expectedName) {
      return modernHeaderMismatch(message, 'Mcp-Name must be present and equal params.name for tools/call.');
    }
  } else if (nameHeader) {
    return modernHeaderMismatch(message, 'Mcp-Name is not valid for this method.');
  }

  const meta = message.params?._meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return modernHeaderMismatch(message, 'params._meta is required for MCP 2026-07-28 requests.');
  }
  if (meta[MODERN_PROTOCOL_META_KEY] !== MODERN_PROTOCOL_VERSION) {
    return modernHeaderMismatch(message, 'Request metadata protocolVersion must match MCP-Protocol-Version.');
  }

  const clientCapabilities = meta[MODERN_CLIENT_CAPABILITIES_META_KEY];
  if (!clientCapabilities || typeof clientCapabilities !== 'object' || Array.isArray(clientCapabilities)) {
    return modernHeaderMismatch(message, 'Request metadata clientCapabilities is required and must be an object.');
  }

  if (Object.prototype.hasOwnProperty.call(meta, MODERN_CLIENT_INFO_META_KEY)) {
    const clientInfo = meta[MODERN_CLIENT_INFO_META_KEY];
    if (
      !clientInfo
      || typeof clientInfo !== 'object'
      || Array.isArray(clientInfo)
      || typeof clientInfo.name !== 'string'
      || !clientInfo.name.trim()
      || typeof clientInfo.version !== 'string'
      || !clientInfo.version.trim()
    ) {
      return modernHeaderMismatch(message, 'clientInfo metadata must contain non-empty name and version strings.');
    }
  }

  return null;
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
  const safeProviderError = error instanceof ProofModeGitHubError
    && Object.prototype.hasOwnProperty.call(SAFE_TOOL_ERROR_MESSAGES, suppliedCode);
  const errorCode = safeProviderError ? suppliedCode : 'audit_failed';
  const message = safeProviderError
    ? SAFE_TOOL_ERROR_MESSAGES[suppliedCode]
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

async function dispatch(message, deps, protocolVersion) {
  const { id, method, params } = message;
  const modern = protocolVersion === MODERN_PROTOCOL_VERSION;

  if (modern && method === 'server/discover') {
    return jsonRpc(id, {
      supportedVersions: [MODERN_PROTOCOL_VERSION],
      capabilities: SERVER_CAPABILITIES,
      instructions: SERVER_INSTRUCTIONS,
      ttlMs: 0,
      cacheScope: 'private',
    }, protocolVersion);
  }

  if (!modern && method === 'initialize') {
    const requested = params?.protocolVersion;
    const negotiated = LEGACY_PROTOCOLS.has(requested) ? requested : LEGACY_PROTOCOL_VERSION;
    return jsonRpc(id, {
      protocolVersion: negotiated,
      capabilities: SERVER_CAPABILITIES,
      serverInfo: SERVER_INFO,
      instructions: SERVER_INSTRUCTIONS,
    }, protocolVersion);
  }

  if (method === 'ping') return jsonRpc(id, {}, protocolVersion);

  if (method === 'tools/list') {
    return jsonRpc(id, modern
      ? { tools: [TOOL], ttlMs: 0, cacheScope: 'private' }
      : { tools: [TOOL] }, protocolVersion);
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
      return jsonRpc(id, toolResult(report, proofReceipt), protocolVersion);
    } catch (error) {
      return jsonRpc(id, toolError(error), protocolVersion);
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method || 'missing'}`);
}

export async function handleProofModeMcp(request, envOrDeps = {}, maybeDeps) {
  const deps = resolveDeps(envOrDeps, maybeDeps);

  if (!validateOrigin(request)) {
    return jsonResponse(jsonRpcError(null, -32000, 'Origin not allowed.'), 403);
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }

  const protocol = classifyProtocol(request);
  if (protocol.error) return jsonResponse(protocol.error, 400);

  let message;
  try {
    message = await request.json();
  } catch {
    return jsonResponse(jsonRpcError(null, -32700, 'Parse error.'), 400);
  }

  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return jsonResponse(jsonRpcError(message?.id, -32600, 'Invalid Request.'), 400);
  }

  const declaredProtocol = message.params?._meta?.[MODERN_PROTOCOL_META_KEY];
  if (!protocol.explicit && declaredProtocol === MODERN_PROTOCOL_VERSION) {
    return jsonResponse(
      modernHeaderMismatch(message, 'MCP-Protocol-Version is required when request metadata declares MCP 2026-07-28.'),
      400,
    );
  }

  if (protocol.protocolVersion === MODERN_PROTOCOL_VERSION) {
    const mismatch = validateModernEnvelope(request, message);
    if (mismatch) return jsonResponse(mismatch, 400);
    if (message.method === 'initialize') {
      return jsonResponse(jsonRpcError(message.id, -32601, 'initialize is not available in MCP 2026-07-28.'), 400);
    }
  }

  if (message.id === undefined) {
    return new Response(null, { status: 202 });
  }

  return jsonResponse(await dispatch(message, deps, protocol.protocolVersion));
}
