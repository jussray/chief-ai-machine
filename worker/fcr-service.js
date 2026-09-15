import { BUILD_RELEASE_SHA } from './release-sha.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';

export const CHIEF_FCR_RPC_CONTRACT = 'juss-v10/chief-fcr-rpc@v1';
export const CHIEF_CAPABILITY_PLAN_CONTRACT = 'juss-v10/capability-plan@v1';
export const CHIEF_SERVICE_IDENTITY = 'chief-ai';

const FULL_SHA = /^[0-9a-f]{40}$/i;

function normalizeSha(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return FULL_SHA.test(normalized) ? normalized : null;
}

// Public /version compatibility may use an explicit runtime SHA when running
// outside the Wrangler build pipeline. The FCR RPC trust boundary does not.
export function getReleaseSha(env) {
  const candidates = [
    env?.RELEASE_SHA,
    env?.GITHUB_SHA,
    env?.WORKERS_CI_COMMIT_SHA,
    BUILD_RELEASE_SHA,
  ];
  return candidates.map(normalizeSha).find(Boolean) || 'unknown';
}

// Authority-bearing RPC receipts are bound only to the SHA baked into the
// Worker artifact by Wrangler's build command. Runtime/provider variables are
// provenance and cannot override this identity.
export function getArtifactReleaseSha(artifactReleaseSha = BUILD_RELEASE_SHA) {
  return normalizeSha(artifactReleaseSha) || 'unknown';
}

export function getFounderControlRoomServiceVersion(_env, artifactReleaseSha = BUILD_RELEASE_SHA) {
  return {
    ok: true,
    service: CHIEF_SERVICE_IDENTITY,
    rpcContract: CHIEF_FCR_RPC_CONTRACT,
    capabilityPlanContract: CHIEF_CAPABILITY_PLAN_CONTRACT,
    releaseSha: getArtifactReleaseSha(artifactReleaseSha),
  };
}

export async function createFounderControlRoomCapabilityPlan(
  _env,
  input,
  artifactReleaseSha = BUILD_RELEASE_SHA,
) {
  const request = new Request('https://chief-ai.internal/api/chief/capability-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(input),
  });
  const response = await handleChiefCapabilityPlan(request);

  return {
    ok: response.ok,
    status: response.status,
    service: CHIEF_SERVICE_IDENTITY,
    rpcContract: CHIEF_FCR_RPC_CONTRACT,
    capabilityPlanContract: CHIEF_CAPABILITY_PLAN_CONTRACT,
    releaseSha: getArtifactReleaseSha(artifactReleaseSha),
    result: await response.json(),
  };
}
