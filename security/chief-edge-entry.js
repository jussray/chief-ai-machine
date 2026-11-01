import upstream from '../worker/index.js';
import {
  emitReciprocalTelemetry,
  observeFetchRequest,
  syntheticFetchResponse,
} from './reciprocal-ingress.mjs';
import { enforceChiefEdgeRateLimit } from './edge-rate-limit.mjs';

export * from '../worker/index.js';

const edge = {
  ...upstream,
  async fetch(request, env, ctx) {
    const limited = await enforceChiefEdgeRateLimit(request, env);
    if (limited) return limited;

    const observation = await observeFetchRequest(request, env, 'chief-ai');
    emitReciprocalTelemetry(observation, ctx);
    const hallway = syntheticFetchResponse(observation);
    if (hallway) return hallway;
    if (!upstream.fetch) throw new Error('Chief upstream fetch is unavailable');
    return upstream.fetch.call(upstream, request, env, ctx);
  },
};

export default edge;