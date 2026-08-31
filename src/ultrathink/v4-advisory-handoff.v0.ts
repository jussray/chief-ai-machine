import { createHash } from "node:crypto";

export interface V4AdvisoryHandoffV0 {
  schema: "ultrathink/v4-advisory-handoff@v0";
  evidenceLevel: "ATTESTED";
  subjectHash: string;
  observationHash: string;
  learningHash: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Validate an FCR V4 advisory handoff without promoting it into authority.
 * Chief may consume only the deterministic learning hash.
 */
export function validateV4AdvisoryHandoffV0(input: unknown): { learningHash: string } {
  if (!input || typeof input !== "object") throw new Error("invalid V4 advisory handoff");
  const value = input as Record<string, unknown>;

  if (value.schema !== "ultrathink/v4-advisory-handoff@v0") throw new Error("invalid V4 schema");
  if (value.evidenceLevel !== "ATTESTED") throw new Error("V4 evidence level exceeds advisory ceiling");

  const subjectHash = String(value.subjectHash ?? "").toLowerCase();
  const observationHash = String(value.observationHash ?? "").toLowerCase();
  const learningHash = String(value.learningHash ?? "").toLowerCase();
  const digest = /^[a-f0-9]{64}$/;

  if (!digest.test(subjectHash) || !digest.test(observationHash) || !digest.test(learningHash)) {
    throw new Error("invalid V4 digest");
  }

  const expected = sha256(
    `ultrathink/v4-advisory-handoff@v0\n${subjectHash}\n${observationHash}\nATTESTED`,
  );
  if (learningHash !== expected) throw new Error("V4 advisory handoff integrity failure");

  return { learningHash };
}
