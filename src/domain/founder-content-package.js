import { buildFounderContentProposal } from './founder-content-brain.js';
import {
  bindStrategyLeaseToProposal,
  buildFounderContentStrategyLease,
} from './founder-content-strategy.js';

/**
 * Chief's strategy-aware founder-content composition boundary.
 *
 * Strategy may choose and shape the story, but this function deliberately
 * builds the canonical truth/sauce proposal first and derives the claim IDs
 * strategy is allowed to brag about from that validated proposal. The
 * Strategy Lease and binding remain advisory sidecars and never enter FCR's
 * canonical publication-authority hash.
 */
export function buildStrategyAwareFounderContentPackage(input = {}) {
  const proposalInput = input.proposal_input && typeof input.proposal_input === 'object'
    ? input.proposal_input
    : {};
  const strategyInput = input.strategy_input && typeof input.strategy_input === 'object'
    ? input.strategy_input
    : {};
  const useContext = input.use_context && typeof input.use_context === 'object'
    ? input.use_context
    : {};

  const proposal = buildFounderContentProposal(proposalInput);
  const verifiedPublicClaimIds = proposal.public_payload.public_claims
    .filter((claim) => claim.truth_state === 'verified' && claim.public_safe === true)
    .map((claim) => claim.claim_id);

  const strategyLease = buildFounderContentStrategyLease({
    ...strategyInput,
    verified_public_claim_ids: verifiedPublicClaimIds,
  });
  const strategyBinding = bindStrategyLeaseToProposal(strategyLease, proposal, useContext);

  return Object.freeze({
    version: 1,
    kind: 'chief-ai/founder-content-strategy-aware-package',
    proposal,
    strategy_lease: strategyLease,
    strategy_binding: strategyBinding,
    authority: Object.freeze({
      canonical_publication_authority_object: 'proposal',
      strategy_sidecars_advisory_only: true,
      strategy_can_authorize_publish: false,
      strategy_can_change_proposal_hash: false,
    }),
  });
}
