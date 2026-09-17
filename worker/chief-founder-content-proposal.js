import { sha256Hex } from '../src/domain/capability-plan.js';
import { buildStrategyAwareFounderContentPackage } from '../src/domain/founder-content-package.js';

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

function buildStrategyView(strategyLease, proposal) {
  const strategyHash = sha256Hex(JSON.stringify(strategyLease));
  const bragClaimIds = Array.isArray(strategyLease.strategy?.brag_claim_ids)
    ? strategyLease.strategy.brag_claim_ids
    : [];

  return Object.freeze({
    version: strategyLease.version,
    kind: strategyLease.kind,
    state: strategyLease.state,
    strategy_hash: strategyHash,
    platform: proposal.public_payload.platform,
    story_type: proposal.public_payload.story_type,
    evaluated_at: strategyLease.evaluated_at,
    expires_at: strategyLease.expires_at,
    target_audience: Object.freeze({
      segment: strategyLease.audience?.primary_segment || '',
      cares_about: strategyLease.audience?.cares_about || [],
      skepticisms: strategyLease.audience?.skepticisms || [],
      credibility_signals: strategyLease.audience?.credibility_signals || [],
      desired_impression: strategyLease.audience?.desired_impression || '',
      desired_action: strategyLease.audience?.desired_action || '',
    }),
    history: Object.freeze({
      learning_signal_hashes: strategyLease.own_history?.learning_signal_hashes || [],
      post_count: strategyLease.own_history?.post_count ?? 0,
      last_published_at: strategyLease.own_history?.last_published_at ?? null,
    }),
    selected_angle: strategyLease.strategy?.selected_angle || '',
    selected_brag_id: bragClaimIds[0] || null,
    experiment: strategyLease.strategy?.improvement_experiment || '',
    authority: Object.freeze({
      advisory_only: true,
      can_publish: false,
      can_renew_truth: false,
      strategy_evidence_is_not_claim_proof: true,
    }),
  });
}

function validatePackagePair(strategyLease, proposal) {
  if (strategyLease.evaluated_at !== proposal.authority?.proposal_evaluated_at) {
    throw new Error('strategy lease and proposal must share the same evaluated_at boundary');
  }
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

/**
 * Runtime bridge for founder-content reasoning.
 *
 * The live route uses the strategy-aware package as the only composition
 * boundary. Strategy, history, visual direction, and binding are advisory and
 * fail closed before the canonical proposal is handed to FCR. Chief cannot
 * authenticate Current You or evidence, approve publication, or execute a post.
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

  if (
    !record(input)
    || !record(input.strategy)
    || !record(input.proposal)
    || !record(input.visual_direction)
    || !record(input.use_context)
  ) {
    return errorResponse(
      'invalid_founder_content_request',
      'Request body must contain strategy, proposal, visual_direction, and use_context JSON objects.',
    );
  }

  try {
    const contentPackage = buildStrategyAwareFounderContentPackage({
      proposal_input: input.proposal,
      strategy_input: input.strategy,
      visual_direction: input.visual_direction,
      use_context: input.use_context,
      ...(input.v4_advisory_handoff === undefined
        ? {}
        : { v4_advisory_handoff: input.v4_advisory_handoff }),
    });
    const proposal = contentPackage.proposal;
    const strategyLease = contentPackage.strategy_lease;
    validatePackagePair(strategyLease, proposal);
    const strategy = buildStrategyView(strategyLease, proposal);
    const handoff = buildHandoff(strategy, proposal);

    return json({
      data: {
        strategy,
        strategyLease,
        proposal,
        visualDirection: contentPackage.visual_direction,
        strategyBinding: contentPackage.strategy_binding,
        packageAuthority: contentPackage.authority,
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
