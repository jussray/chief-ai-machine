import { sha256Hex } from '../src/domain/capability-plan.js';
import { buildFounderContentProposal } from '../src/domain/founder-content-brain.js';
import { buildFounderContentStrategy } from '../src/domain/founder-content-strategy.js';

const ROUTE = '/api/chief/founder-content-proposal';
const HANDOFF_CONTRACT = 'chief-ai/founder-content-handoff@v1';

function meta() {
  return {
    requestId: globalThis.crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    provenanceId: null,
  };
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function errorResponse(code, message, status = 400) {
  return json({
    data: null,
    meta: meta(),
    error: { code, message },
  }, status);
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function buildHandoff(strategy, proposal) {
  const identity = {
    contract: HANDOFF_CONTRACT,
    strategy_hash: strategy.strategy_hash,
    proposal_hash: proposal.proposal_hash,
    source: proposal.source,
    platform: proposal.public_payload.platform,
    story_type: proposal.public_payload.story_type,
    evaluated_at: proposal.authority.proposal_evaluated_at,
    current_you_intent_id: proposal.authority.current_you_intent_id,
    current_you_intent_version: proposal.authority.current_you_intent_version,
  };

  return Object.freeze({
    ...identity,
    handoff_hash: sha256Hex(JSON.stringify(identity)),
    status: 'proposed',
    authority: Object.freeze({
      strategy_advisory_only: true,
      strategy_evidence_is_not_claim_proof: true,
      submitted_current_you_trust: 'submitted-unverified',
      proposal_only: true,
      execution_authorized: false,
      publish_authorized: false,
      copy_mutation_authorized: false,
      truth_renewal_authorized: false,
      founder_control_room_must_authenticate_current_you: true,
      founder_control_room_must_verify_evidence: true,
      founder_control_room_must_authorize_exact_copy: true,
      provider_readback_required_for_publication_truth: true,
    }),
  });
}

function validatePair(strategy, proposal) {
  const errors = [];
  if (strategy.platform !== proposal.public_payload.platform) {
    errors.push('strategy platform must match proposal platform');
  }
  if (strategy.story_type !== proposal.public_payload.story_type) {
    errors.push('strategy story_type must match proposal story_type');
  }
  if (strategy.evaluated_at !== proposal.authority.proposal_evaluated_at) {
    errors.push('strategy and proposal must share the same evaluated_at boundary');
  }
  if (errors.length > 0) throw new Error(errors.join('; '));
}

/**
 * Runtime bridge for founder-content reasoning.
 *
 * Chief may bind an advisory audience/history/discourse strategy to an exact-copy
 * proposal. It cannot authenticate Current You or evidence, approve publication,
 * or execute the post. FCR remains the authenticated founder, evidence, and
 * publication-authority boundary.
 */
export async function handleChiefFounderContentProposal(request) {
  const url = new URL(request.url);
  if (url.pathname !== ROUTE) {
    return errorResponse('not_found', 'Chief founder-content proposal route not found.', 404);
  }

  if (request.method !== 'POST') {
    return errorResponse(
      'method_not_allowed',
      'POST is required for founder-content proposals.',
      405,
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return errorResponse('invalid_json', 'Request body must be valid JSON.');
  }

  if (!record(input) || !record(input.strategy) || !record(input.proposal)) {
    return errorResponse(
      'invalid_founder_content_request',
      'Request body must contain strategy and proposal JSON objects.',
    );
  }

  try {
    const strategy = buildFounderContentStrategy(input.strategy);
    const proposal = buildFounderContentProposal(input.proposal);
    validatePair(strategy, proposal);
    const handoff = buildHandoff(strategy, proposal);

    return json({
      data: {
        strategy,
        proposal,
        handoff,
        governanceBoundary: {
          proposalOnly: true,
          executionAuthorized: false,
          publishAuthorized: false,
          strategyAdvisoryOnly: true,
          strategyEvidenceCanProveClaims: false,
          submittedEvidenceAuthenticated: false,
          submittedCurrentYouAuthenticated: false,
          submittedCurrentYouTrust: 'submitted-unverified',
          currentYouPublicationApprovalResolvedByChief: false,
          founderControlRoomMustAuthenticateCurrentYou: true,
          founderControlRoomVerificationRequired: true,
          founderControlRoomExactCopyApprovalRequired: true,
          providerReadbackRequiredForPublishedTruth: true,
          nextGate:
            'Founder Control Room must authenticate Current You, authenticate the proposal evidence, re-check temporal truth at the execution boundary, issue or resolve authoritative founder approval for the exact public payload, and require provider readback before any published claim is true.',
        },
      },
      meta: meta(),
      error: null,
    });
  } catch (error) {
    return errorResponse(
      'invalid_founder_content_request',
      error instanceof Error ? error.message : 'Founder-content proposal could not be created.',
    );
  }
}
