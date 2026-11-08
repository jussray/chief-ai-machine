import upstream from '../worker/index.js';
import {
  emitReciprocalTelemetry,
  observeFetchRequest,
  syntheticFetchResponse,
} from './reciprocal-ingress.mjs';

export * from '../worker/index.js';

const edge = {
  ...upstream,
  async fetch(request, env, ctx) {
    const observation = await observeFetchRequest(request, env, 'chief-ai');
    emitReciprocalTelemetry(observation, ctx);
    const hallway = syntheticFetchResponse(observation);
    if (hallway) return hallway;
    if (!upstream.fetch) throw new Error('Chief upstream fetch is unavailable');
    return upstream.fetch.call(upstream, request, env, ctx);
  },
};

export default edge;
