import { validateFounderContentV4AdvisoryHandoff } from "../domain/founder-content-v4-advisory.js";

export interface V4AdvisoryHandoffV0 {
  schema: "ultrathink/v4-advisory-handoff@v0";
  evidenceLevel: "ATTESTED";
  subjectHash: string;
  observationHash: string;
  learningHash: string;
}

/**
 * Reuse Chief's Worker-safe runtime validator so contract tests and deployed
 * founder-content behavior cannot silently drift into separate semantics.
 */
export function validateV4AdvisoryHandoffV0(input: unknown): { learningHash: string } {
  return validateFounderContentV4AdvisoryHandoff(input);
}
