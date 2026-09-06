import { createHash } from "node:crypto";

export interface V4AdvisoryHandoffV0 {
  schema: "ultrathink/v4-advisory-handoff@v0";
  evidenceLevel: "ATTESTED";
  subjectHash: string;
  observationHash: string;
  learningHash: string;
}

const EXACT_FIELDS = ["evidenceLevel", "learningHash", "observationHash", "schema", "subjectHash"];

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Validate an FCR V4 advisory handoff without promoting it into authority.
 * Chief may consume only the deterministic learning hash.
 */
export function validateV4AdvisoryHandoffV0(input: unknown): { learningHash: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("invalid V4 advisory handoff");
  }
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  if (keys.length !== EXACT_FIELDS.length || keys.some((key, index) => key !== EXACT_FIELDS[index])) {
    throw new Error("V4 advisory handoff contains non-advisory fields");
  }

  if (value.schema !== "ultrathink/v4-advisory-handoff@v0") throw new Error("invalid V4 schema");
  if (value.evidenceLevel !== "ATTESTED") throw new Error("V4 evidence level exceeds advisory ceiling");

  const subjectHash = String(value.subjectHash ?? "").trim().toLowerCase();
  const observationHash = String(value.observationHash ?? "").trim().toLowerCase();
  const learningHash = String(value.learningHash ?? "").trim().toLowerCase();
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
