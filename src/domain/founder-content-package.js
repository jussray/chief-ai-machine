import { createHash } from 'node:crypto';
import { buildFounderContentProposal } from './founder-content-brain.js';
import {
  bindStrategyLeaseToProposal,
  buildFounderContentStrategyLease,
} from './founder-content-strategy-lease.js';
import { attachV4AdvisoryLearningToStrategyInput } from './founder-content-v4-advisory.js';
import { buildFounderContentVisualDirection } from './founder-content-visual-direction.js';

const HASH = /^[0-9a-f]{64}$/i;

function normalizedDraft(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
    : '';
}

export function founderContentDraftFingerprint(value) {
  return createHash('sha256').update(normalizedDraft(value)).digest('hex');
}

function recentDraftFingerprints(strategyInput) {
  const value = strategyInput?.own_history?.recent_draft_fingerprints;
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) {
    throw new Error('FOUNDER_CONTENT_STRATEGY_REJECTED: own_history.recent_draft_fingerprints must be an array of at most 30 sha256 fingerprints');
  }
  const fingerprints = value.map((item) => typeof item === 'string' ? item.trim().toLowerCase() : '');
  if (fingerprints.some((item) => !HASH.test(item))) {
    throw new Error('FOUNDER_CONTENT_STRATEGY_REJECTED: own_history.recent_draft_fingerprints must contain only sha256 fingerprints');
  }
  return [...new Set(fingerprints)];
}

/**
 * Chief's strategy-aware founder-content composition boundary.
 *
 * Strategy may choose and shape the story, but this function deliberately
 * builds the canonical truth/sauce proposal first and derives the claim IDs
 * strategy is allowed to brag about from that validated proposal. The
 * Strategy Lease, visual direction, and binding remain advisory sidecars and
 * never enter FCR's canonical publication-authority hash.
 *
 * When an FCR V4 advisory handoff is supplied, only its validated learning
 * hash is added to strategy memory. Subject/observation hashes and any raw
 * evidence remain outside the strategy package.
 */
export function buildStrategyAwareFounderContentPackage(input = {}) {
  const proposalInput = input.proposal_input && typeof input.proposal_input === 'object'
    ? input.proposal_input
    : {};
  const submittedStrategyInput = input.strategy_input && typeof input.strategy_input === 'object'
    ? input.strategy_input
    : {};
  const strategyInput = input.v4_advisory_handoff === undefined
    ? submittedStrategyInput
    : attachV4AdvisoryLearningToStrategyInput(submittedStrategyInput, input.v4_advisory_handoff);
  const useContext = input.use_context && typeof input.use_context === 'object'
    ? input.use_context
    : {};

  const proposal = buildFounderContentProposal(proposalInput);
  const draftFingerprint = founderContentDraftFingerprint(proposal.public_payload.draft_text);
  if (recentDraftFingerprints(strategyInput).includes(draftFingerprint)) {
    throw new Error(
      'FOUNDER_CONTENT_STRATEGY_REJECTED: canonical public draft repeats a recent normalized draft; choose a materially different story',
    );
  }

  const verifiedPublicClaimIds = proposal.public_payload.public_claims
    .filter((claim) => claim.truth_state === 'verified' && claim.public_safe === true)
    .map((claim) => claim.claim_id);

  const strategyLease = buildFounderContentStrategyLease({
    ...strategyInput,
    verified_public_claim_ids: verifiedPublicClaimIds,
  });
  const strategyBinding = bindStrategyLeaseToProposal(strategyLease, proposal, useContext);
  const visualDirection = buildFounderContentVisualDirection(input.visual_direction, {
    thesis: proposal.public_payload.draft_text,
  });

  return Object.freeze({
    version: 1,
    kind: 'chief-ai/founder-content-strategy-aware-package',
    proposal,
    strategy_lease: strategyLease,
    visual_direction: visualDirection,
    strategy_binding: Object.freeze({
      ...strategyBinding,
      draft_fingerprint: draftFingerprint,
    }),
    authority: Object.freeze({
      canonical_publication_authority_object: 'proposal',
      strategy_sidecars_advisory_only: true,
      strategy_can_authorize_publish: false,
      strategy_can_change_proposal_hash: false,
      visual_direction_can_authorize_publish: false,
      visual_direction_can_expand_claim_scope: false,
    }),
  });
}
