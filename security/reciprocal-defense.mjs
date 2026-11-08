import { createHash, createHmac } from "node:crypto";

export const HALLWAY_BASE_EXPANSION = 48_000;
export const HALLWAY_RANDOM_MAX = 47_999;

export const FULL_ATTACK_UNIT = Object.freeze([
  "attack-10","attack-20","attack-30","attack-3000","attack-5000","attack-6000","attack-48000",
  "redteam-i","redteam-ii","redteam-twin","devil","ultrathink","l99","lindymode","ooda",
  "truthmode","confess","goalfix","proof-mode","fingerprint","continuity","exact-head","rollback"
]);

const AUTHORIZATION_STATES = new Set(["AUTHORIZED", "UNAUTHORIZED", "UNKNOWN", "NOT_EVALUATED"]);

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

function keyedFingerprint(secret, label, value) {
  if (value == null || value === "") return null;
  return createHmac("sha256", secret).update(`${label}:${String(value)}`).digest("hex");
}

function boundedExpansion(secret, eventDigest) {
  const hex = createHmac("sha256", secret).update(eventDigest).digest("hex").slice(0, 12);
  return Number.parseInt(hex, 16) % (HALLWAY_RANDOM_MAX + 1);
}

function normalizeAuthorization(input) {
  const raw = input?.authorization ?? {};
  const state = AUTHORIZATION_STATES.has(raw.state) ? raw.state : "NOT_EVALUATED";
  const evidenceRefs = Array.isArray(raw.evidenceRefs)
    ? [...new Set(raw.evidenceRefs.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].sort()
    : [];
  return Object.freeze({ state, evidenceRefs: Object.freeze(evidenceRefs), derivedFromRuntimeSignals: false });
}

export function reciprocalDefenseStep(input, secret) {
  if (!secret) throw new Error("hallway secret required");
  const event = {
    actor: input.actor ?? "unknown",
    sourceFingerprint: keyedFingerprint(secret, "ip", input.sourceIp),
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
  const authorization = normalizeAuthorization(input);

  const decision = {
    schema: "juss/reciprocal-defense@v1",
    mode: "bounded-defensive-hallway",
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
      signals: ["source-ip-pseudonym","asn","rdns-verification","user-agent","tls-http-fingerprint","behavior","canary-events"],
      humanIdentityRequiresIndependentEvidence: true,
    },
    authorization,
    boundaries: {
      ownedSurfaceOnly: true,
      authorizationInferred: false,
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
    && result.mode === "bounded-defensive-hallway"
    && result.attackUnit.length === FULL_ATTACK_UNIT.length
    && FULL_ATTACK_UNIT.every((flow) => result.attackUnit.includes(flow))
    && result.hallway.baseExpansion === HALLWAY_BASE_EXPANSION
    && result.hallway.logicalExpansion >= HALLWAY_BASE_EXPANSION
    && result.hallway.logicalExpansion <= HALLWAY_BASE_EXPANSION + HALLWAY_RANDOM_MAX
    && result.hallway.productionExposure === 0
    && result.authorization?.derivedFromRuntimeSignals === false
    && result.boundaries.ownedSurfaceOnly === true
    && result.boundaries.authorizationInferred === false
    && result.boundaries.externalCompromise === false;
}
