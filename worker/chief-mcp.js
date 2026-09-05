import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleProofModeMcp } from './proofmode-mcp.js';

const MODERN_PROTOCOL_VERSION = '2026-07-28';
const LEGACY_PROTOCOLS = new Set(['2025-11-25', '2025-06-18', '2025-03-26']);
const SUPPORTED_PROTOCOLS = new Set([MODERN_PROTOCOL_VERSION, ...LEGACY_PROTOCOLS]);
const PROTOCOL_META = 'io.modelcontextprotocol/protocolVersion';
const CLIENT_CAPABILITIES_META = 'io.modelcontextprotocol/clientCapabilities';
const SERVER_INFO_META = 'io.modelcontextprotocol/serverInfo';
const MAX_BODY_BYTES = 64 * 1024;
const SERVER_INFO = {
  name: 'chief-ai-machine',
  title: 'Chief AI Machine',
  version: '0.1.0',
};
const CHIEF_INSTRUCTIONS =
  'Chief composes bounded capability-plan proposals, audits repository evidence, and reads public dependency documentation. Chief never grants founder approval, execution authority, provider mutation, merge, deploy, publication, or outcome truth. Founder Control Room remains the authority, evidence, and connection broker.';

const CAPABILITY_PLAN_TOOL = {
  name: 'compose_capability_plan',
  title: 'Compose a Chief capability plan',
  description:
    'Use Chief reasoning to compose a proposal-only capability plan from a founder goal and submitted registry snapshot. The result is non-authorizing and must be resolved, verified, approved, and executed through Founder Control Room.',
  inputSchema: {
    type: 'object',
    properties: {
      proposal: {
        type: 'object',
        description:
          'Chief capability-plan proposal input. Accepted top-level fields are goalPlan, registrySnapshot, expectedHeadSha, requestedAuthority, latestOutcomeObservation, and connectionRequests.',
      },
    },
    required: ['proposal'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

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
    const bytes = Uint8Array.from(
      atob(value.slice('=?base64?'.length, -2)),
      (char) => char.charCodeAt(0),
    );
    return new globalThis.TextDecoder().decode(bytes);
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
    return jsonRpcError(
      message?.id,
      -32020,
      'Header mismatch: MCP protocol version is missing or inconsistent.',
    );
  }
  if (!isRecord(meta?.[CLIENT_CAPABILITIES_META])) {
    return jsonRpcError(
      message?.id,
      -32600,
      'Modern MCP requests require client capabilities in _meta.',
    );
  }
  if (request.headers.get('Mcp-Method') !== message.method) {
    return jsonRpcError(
      message?.id,
      -32020,
      'Header mismatch: Mcp-Method does not match the request body.',
    );
  }
  if (message.method === 'tools/call') {
    const headerName = request.headers.get('Mcp-Name');
    if (!headerName || decodeHeaderValue(headerName) !== message.params?.name) {
      return jsonRpcError(
        message?.id,
        -32020,
        'Header mismatch: Mcp-Name does not match the request body.',
      );
    }
  }
  return null;
}

function modernResult(value) {
  return {
    resultType: 'complete',
    ...value,
    _meta: {
      ...(isRecord(value?._meta) ? value._meta : {}),
      [SERVER_INFO_META]: SERVER_INFO,
    },
  };
}

function toolResult(value, modern) {
  const base = {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    isError: false,
  };
  return modern ? modernResult(base) : base;
}

function toolError(error, modern) {
  const message = error instanceof Error ? error.message : 'Chief capability-plan proposal failed.';
  const base = {
    content: [{ type: 'text', text: message }],
    structuredContent: { errorCode: 'capability_plan_failed', message },
    isError: true,
  };
  return modern ? modernResult(base) : base;
}

function validateCapabilityPlanArguments(args) {
  if (!isRecord(args)) {
    return 'compose_capability_plan arguments must be an object.';
  }
  const keys = Object.keys(args).sort();
  if (keys.length !== 1 || keys[0] !== 'proposal') {
    return 'compose_capability_plan accepts exactly one argument: proposal.';
  }
  if (!isRecord(args.proposal)) {
    return 'compose_capability_plan proposal must be an object.';
  }

  const allowedProposalKeys = new Set([
    'goalPlan',
    'registrySnapshot',
    'expectedHeadSha',
    'requestedAuthority',
    'latestOutcomeObservation',
    'connectionRequests',
  ]);
  const unexpected = Object.keys(args.proposal)
    .filter((key) => !allowedProposalKeys.has(key))
    .sort();
  if (unexpected.length > 0) {
    return `compose_capability_plan proposal contains unexpected fields: ${unexpected.join(', ')}`;
  }

  return null;
}

function assertNonAuthorizingProposal(data) {
  if (!isRecord(data) || !isRecord(data.governanceBoundary) || !isRecord(data.founderControl)) {
    throw new Error('Chief capability-plan response is missing governance boundaries.');
  }
  if (
    data.governanceBoundary.proposalOnly !== true
    || data.governanceBoundary.executionAuthorized !== false
    || data.governanceBoundary.founderApprovalRequired !== true
    || data.governanceBoundary.remoteFounderSurfacesMaySelfAuthorize !== false
    || data.founderControl.chiefMaySelfAuthorize !== false
    || data.founderControl.surfaceMaySelfAuthorize !== false
    || data.founderControl.executionAuthorized !== false
  ) {
    throw new Error('Chief capability-plan response attempted to widen authority.');
  }
}

async function composeCapabilityPlan(proposal) {
  const response = await handleChiefCapabilityPlan(new Request(
    'https://chief.internal/api/chief/capability-plan',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposal),
    },
  ));
  const payload = await response.json();
  if (!response.ok || !isRecord(payload) || !isRecord(payload.data)) {
    const message = isRecord(payload?.error) && typeof payload.error.message === 'string'
      ? payload.error.message
      : `Chief capability-plan proposal failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  assertNonAuthorizingProposal(payload.data);
  return {
    schema: 'juss/chief-mcp-capability-proposal@v1',
    ...payload.data,
    authority: {
      proposalOnly: true,
      founderApprovalAuthority: false,
      executionAuthority: false,
      providerMutationAuthority: false,
      mergeAuthority: false,
      deployAuthority: false,
      publicationAuthority: false,
      outcomeVerificationAuthority: false,
      nextAuthority: 'founder-control-room',
    },
  };
}

function rewriteServerIdentity(payload, method) {
  if (!isRecord(payload) || !isRecord(payload.result)) return payload;

  if (method === 'initialize') {
    payload.result.serverInfo = SERVER_INFO;
    payload.result.instructions = CHIEF_INSTRUCTIONS;
  }

  if (method === 'server/discover') {
    payload.result.instructions = CHIEF_INSTRUCTIONS;
  }

  if (method === 'tools/list' && Array.isArray(payload.result.tools)) {
    const tools = payload.result.tools.filter((tool) => tool?.name !== CAPABILITY_PLAN_TOOL.name);
    payload.result.tools = [...tools, CAPABILITY_PLAN_TOOL];
  }

  if (isRecord(payload.result._meta)) {
    payload.result._meta[SERVER_INFO_META] = SERVER_INFO;
  }

  return payload;
}

async function delegateProofMode(request, envOrDeps, maybeDeps, method) {
  const response = await handleProofModeMcp(request, envOrDeps, maybeDeps);
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) return response;

  let payload;
  try {
    payload = await response.json();
  } catch {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(rewriteServerIdentity(payload, method)), {
    status: response.status,
    headers,
  });
}

export async function handleChiefMcp(request, envOrDeps = {}, maybeDeps) {
  const delegateRequest = request.clone();

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
    return jsonResponse(jsonRpcError(message.id, -32022, 'Unsupported protocol version.'), 400);
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
    return new Response(null, { status: 202 });
  }

  if (message.method !== 'tools/call' || message.params?.name !== CAPABILITY_PLAN_TOOL.name) {
    return delegateProofMode(delegateRequest, envOrDeps, maybeDeps, message.method);
  }

  const args = message.params?.arguments || {};
  const validationError = validateCapabilityPlanArguments(args);
  if (validationError) {
    return jsonResponse(jsonRpcError(message.id, -32602, validationError), 200);
  }

  try {
    const value = await composeCapabilityPlan(args.proposal);
    return jsonResponse(jsonRpc(message.id, toolResult(value, modern)));
  } catch (error) {
    return jsonResponse(jsonRpc(message.id, toolError(error, modern)));
  }
}
