import { createHash, createHmac } from "node:crypto";

export const HALLWAY_BASE_EXPANSION = 48_000;
export const HALLWAY_RANDOM_MAX = 47_999;

export const FULL_ATTACK_UNIT = Object.freeze([
  "attack-10","attack-20","attack-30","attack-3000","attack-5000","attack-6000","attack-48000",
  "redteam-i","redteam-ii","redteam-twin","devil","ultrathink","l99","lindymode","ooda",
  "truthmode","confess","goalfix","proof-mode","fingerprint","continuity","exact-head","rollback"
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function boundedExpansion(secret, eventDigest) {
  const hex = createHmac("sha256", secret).update(eventDigest).digest("hex").slice(0, 12);
  return Number.parseInt(hex, 16) % (HALLWAY_RANDOM_MAX + 1);
}

export function reciprocalDefenseStep(input, secret) {
  if (!secret) throw new Error("hallway secret required");
  const event = {
    actor: input.actor ?? "unknown",
    sourceIp: input.sourceIp ?? null,
    asn: input.asn ?? null,
    userAgent: input.userAgent ?? null,
    tlsFingerprint: input.tlsFingerprint ?? null,
    route: input.route ?? null,
    method: input.method ?? null,
    timestamp: input.timestamp ?? new Date().toISOString(),
    priorReceipt: input.priorReceipt ?? null,
  };
  const eventDigest = digest(event);
  const randomExpansion = boundedExpansion(secret, eventDigest);
  const logicalExpansion = HALLWAY_BASE_EXPANSION + randomExpansion;

  const decision = {
    schema: "juss/reciprocal-defense@v1",
    mode: "authorized-active-defense",
    event,
    eventDigest,
    attackUnit: [...FULL_ATTACK_UNIT],
    attackUnitMode: "all-applicable-every-meaningful-step",
    offense: {
      job1: "pressure-test-owned-defense",
      job2: "identify-challenge-divert-and-deceive-on-owned-surfaces",
    },
    defense: {
      job1: "protect-isolate-rate-shape-and-contain",
      job2: "learn-harden-repair-and-prove-successor-state",
    },
    hallway: {
      baseExpansion: HALLWAY_BASE_EXPANSION,
      randomExpansion,
      logicalExpansion,
      lazyMaterialization: true,
      productionExposure: 0,
      realCustomerData: false,
      realCredentials: false,
      crossSessionSharing: false,
    },
    attribution: {
      goal: "strongest-evidence-bound-technical-identity",
      signals: ["source-ip","asn","rdns-verification","user-agent","tls-http-fingerprint","behavior","canary-events"],
      humanIdentityRequiresIndependentEvidence: true,
    },
    boundaries: {
      ownedOrAuthorizedSurfacesOnly: true,
      externalCompromise: false,
      externalExploit: false,
      outboundRetaliation: false,
      publicMetadataEnrichmentAllowed: true,
    },
  };

  return Object.freeze({ ...decision, receipt: digest(decision) });
}

export function verifyReciprocalDefenseReceipt(result) {
  if (!result || result.schema !== "juss/reciprocal-defense@v1") return false;
  const { receipt, ...decision } = result;
  return receipt === digest(decision)
    && result.attackUnit.length === FULL_ATTACK_UNIT.length
    && FULL_ATTACK_UNIT.every((flow) => result.attackUnit.includes(flow))
    && result.hallway.baseExpansion === HALLWAY_BASE_EXPANSION
    && result.hallway.logicalExpansion >= HALLWAY_BASE_EXPANSION
    && result.hallway.logicalExpansion <= HALLWAY_BASE_EXPANSION + HALLWAY_RANDOM_MAX
    && result.hallway.productionExposure === 0
    && result.boundaries.ownedOrAuthorizedSurfacesOnly === true
    && result.boundaries.externalCompromise === false;
}
