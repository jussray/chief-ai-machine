import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateV4AdvisoryHandoffV0 } from "../../src/ultrathink/v4-advisory-handoff.v0";

const subjectHash = "a".repeat(64);
const observationHash = "b".repeat(64);
const learningHash = createHash("sha256")
  .update(`ultrathink/v4-advisory-handoff@v0\n${subjectHash}\n${observationHash}\nATTESTED`, "utf8")
  .digest("hex");
const handoff = {
  schema: "ultrathink/v4-advisory-handoff@v0",
  evidenceLevel: "ATTESTED",
  subjectHash,
  observationHash,
  learningHash,
};

describe("FCR V4 advisory consumption", () => {
  it("accepts a valid ATTESTED handoff and exposes only learningHash", () => {
    expect(validateV4AdvisoryHandoffV0(handoff)).toEqual({ learningHash });
  });

  it("rejects authority laundering above ATTESTED", () => {
    expect(() =>
      validateV4AdvisoryHandoffV0({
        ...handoff,
        evidenceLevel: "VERIFIED_CURRENT",
      }),
    ).toThrow(/advisory ceiling/);
  });

  it("rejects tampered learning hashes", () => {
    expect(() =>
      validateV4AdvisoryHandoffV0({
        ...handoff,
        learningHash: "c".repeat(64),
      }),
    ).toThrow(/integrity/);
  });

  it("rejects raw or otherwise non-advisory fields", () => {
    expect(() =>
      validateV4AdvisoryHandoffV0({
        ...handoff,
        raw_metrics: { impressions: 999 },
      }),
    ).toThrow(/non-advisory fields/);
  });
});
