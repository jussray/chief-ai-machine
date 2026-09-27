import { WorkerEntrypoint } from 'cloudflare:workers';
import {
  createFounderControlRoomCapabilityPlan,
  getFounderControlRoomProviderStates,
  getFounderControlRoomServiceVersion,
  ingestFounderControlRoomBipEvidence,
  invokeFounderControlRoomProvider,
} from './fcr-service.js';
import httpWorker from './http-worker.js';

export class FounderControlRoomEntrypoint extends WorkerEntrypoint {
  async version() {
    return getFounderControlRoomServiceVersion(this.env);
  }

  async providerStates() {
    return getFounderControlRoomProviderStates(this.env);
  }

  async invokeProvider(input) {
    return invokeFounderControlRoomProvider(this.env, input);
  }

  async createCapabilityPlan(input) {
    return createFounderControlRoomCapabilityPlan(this.env, input);
  }

  async ingestBipEvidence(input) {
    return ingestFounderControlRoomBipEvidence(this.env, input);
  }
}

// Chief AI Worker composition root.
//
// HTTP routing lives in a runtime-neutral module so Node/Vitest can verify the
// /version and request-routing contract without loading Cloudflare's RPC-only
// virtual module. Named WorkerEntrypoint exports remain here for the FCR
// Cloudflare Service Binding.
export default httpWorker;