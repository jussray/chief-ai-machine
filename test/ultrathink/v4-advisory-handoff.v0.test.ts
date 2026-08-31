import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateV4AdvisoryHandoffV0 } from "../../src/ultrathink/v4-advisory-handoff.v0";

const subjectHash = "a".repeat(64);
const observationHash = "b".repeat(64);
const learningHash = createHash("sha256")
  .update(`ultrathink/v4-advisory-handoff@v0\n${subjectHash}\n${observationHash}\nATTESTED`, "utf8")
  .digest("hex");

describe("FCR V4 advisory consumption", () => {
  it("accepts a valid ATTESTED handoff and exposes only learningHash", () => {
    expect(
      validateV4AdvisoryHandoffV0({
        schema: "ultrathink/v4-advisory-handoff@v0",
        evidenceLevel: "ATTESTED",
        subjectHash,
        observationHash,
        learningHash,
      }),
    ).toEqual({ learningHash });
  });

  it("rejects authority laundering above ATTESTED", () => {
    expect(() =>
      validateV4AdvisoryHandoffV0({
        schema: "ultrathink/v4-advisory-handoff@v0",
        evidenceLevel: "VERIFIED_CURRENT",
        subjectHash,
        observationHash,
        learningHash,
      }),
    ).toThrow(/advisory ceiling/);
  });

  it("rejects tampered learning hashes", () => {
    expect(() =>
      validateV4AdvisoryHandoffV0({
        schema: "ultrathink/v4-advisory-handoff@v0",
        evidenceLevel: "ATTESTED",
        subjectHash,
        observationHash,
        learningHash: "c".repeat(64),
      }),
    ).toThrow(/integrity/);
  });
});
