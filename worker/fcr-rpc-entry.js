import { WorkerEntrypoint } from 'cloudflare:workers';
import {
  createFounderControlRoomCapabilityPlan,
  getFounderControlRoomServiceVersion,
  ingestFounderControlRoomBipEvidence,
  acceptFounderControlRoomPromptOSCommandIntent,
} from './fcr-service.js';

// Cloudflare-only RPC entrypoint. Keep the HTTP composition root safe to
// import from Node tests; the edge Worker exports this named class directly.
export class FounderControlRoomEntrypoint extends WorkerEntrypoint {
  async version() {
    return getFounderControlRoomServiceVersion(this.env);
  }

  async createCapabilityPlan(input) {
    return createFounderControlRoomCapabilityPlan(this.env, input);
  }

  async ingestBipEvidence(input) {
    return ingestFounderControlRoomBipEvidence(this.env, input);
  }

  async acceptPromptOSCommandIntent(input) {
    return acceptFounderControlRoomPromptOSCommandIntent(this.env, input);
  }
}
