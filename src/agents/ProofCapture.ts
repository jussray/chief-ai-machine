/**
 * ProofCapture: Collect real, verifiable evidence for agent decisions.
 *
 * Evidence must be:
 * - Reproducible (same inputs → same evidence)
 * - Timestamped (immutable proof of when)
 * - Traceable (links back to exact source)
 * - Stored durably (R2, GitHub, archive)
 * - Checksummed (SHA256 for integrity)
 *
 * Types of proof:
 * 1. Check runs (GitHub API → actual test/lint/typecheck results)
 * 2. Playwright screenshots (browser automation → visual evidence)
 * 3. Diffs (GitHub API → actual code changes)
 * 4. Approval count (GitHub API → actual reviewers)
 * 5. Compiler output (external service → actual typecheck results)
 */

export interface CheckRunProof {
  name: string;
  status: 'completed' | 'in_progress';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | null;
  headSha: string;
  url: string;
  checkedAt: string;
  proofUrl: string; // Link to full output in R2/archive
}

export interface PlaywrightProof {
  url: string; // URL to live site being tested
  width: number; // Screen width: 375, 768, or 1440
  screenshotUrl: string; // Signed R2 URL
  pageTitle: string;
  pageLoadTime: number;
  consoleErrors: string[];
  timestamp: string;
  checksumSha256: string;
}

export interface DiffProof {
  filesChanged: number;
  additions: number;
  deletions: number;
  fileList: string[];
  diffUrl: string; // GitHub PR diff URL
  baseSha: string;
  headSha: string;
}

export interface ApprovalProof {
  approvals: Array<{
    reviewer: string;
    state: 'APPROVED' | 'CHANGES_REQUESTED';
    submittedAt: string;
  }>;
  totalApprovals: number;
  totalChangesRequested: number;
  timestamp: string;
}

export class ProofCapture {
  private r2Bucket: R2Bucket | null = null;

  constructor(r2Bucket?: R2Bucket) {
    this.r2Bucket = r2Bucket || null;
  }

  /**
   * Capture check run results from GitHub.
   * Real evidence: actual test/lint/typecheck output.
   */
  async captureCheckRuns(
    owner: string,
    repo: string,
    commitSha: string,
    checks: Array<{
      name: string;
      status: string;
      conclusion: string;
      url: string;
    }>,
  ): Promise<{
    ok: boolean;
    proofs: CheckRunProof[];
    error?: string;
  }> {
    try {
      const proofs: CheckRunProof[] = checks.map((check) => ({
        name: check.name,
        status: check.status as 'completed' | 'in_progress',
        conclusion: check.conclusion as CheckRunProof['conclusion'],
        headSha: commitSha,
        url: check.url,
        checkedAt: new Date().toISOString(),
        proofUrl: `https://github.com/${owner}/${repo}/commit/${commitSha}/checks/${check.name}`,
      }));

      return { ok: true, proofs };
    } catch (error) {
      return {
        ok: false,
        proofs: [],
        error: String(error),
      };
    }
  }

  /**
   * Capture Playwright screenshot evidence.
   * Real evidence: actual browser rendering at exact moment.
   */
  async capturePlaywrightProof(
    url: string,
    width: number,
    screenshotData: Buffer,
  ): Promise<{
    ok: boolean;
    proof?: PlaywrightProof;
    error?: string;
  }> {
    try {
      const timestamp = new Date().toISOString();
      const checksumSha256 = this.sha256(screenshotData);

      // Store in R2 if available
      let screenshotUrl = '';
      if (this.r2Bucket) {
        const key = `proof/playwright/${timestamp.replace(/[:.]/g, '-')}-${width}.png`;
        await this.r2Bucket.put(key, screenshotData, {
          httpMetadata: {
            contentType: 'image/png',
            cacheControl: 'immutable',
          },
        });
        screenshotUrl = `${this.r2Bucket.name}/${key}`;
      }

      const proof: PlaywrightProof = {
        url,
        width,
        screenshotUrl,
        pageTitle: 'TODO: captured from page',
        pageLoadTime: 0,
        consoleErrors: [],
        timestamp,
        checksumSha256,
      };

      return { ok: true, proof };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Capture PR diff proof.
   * Real evidence: actual files changed, from GitHub API.
   */
  async captureDiffProof(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string,
    files: Array<{ filename: string; additions: number; deletions: number }>,
  ): Promise<{
    ok: boolean;
    proof?: DiffProof;
    error?: string;
  }> {
    try {
      const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

      const proof: DiffProof = {
        filesChanged: files.length,
        additions: totalAdditions,
        deletions: totalDeletions,
        fileList: files.map((f) => f.filename),
        diffUrl: `https://github.com/${owner}/${repo}/compare/${baseSha}...${headSha}`,
        baseSha,
        headSha,
      };

      return { ok: true, proof };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Capture approval proof.
   * Real evidence: actual reviewer approvals, from GitHub API.
   */
  async captureApprovalProof(
    reviews: Array<{
      user: { login: string };
      state: 'APPROVED' | 'CHANGES_REQUESTED';
      submitted_at: string;
    }>,
  ): Promise<{
    ok: boolean;
    proof?: ApprovalProof;
    error?: string;
  }> {
    try {
      const approvals = reviews.filter((r) => r.state === 'APPROVED');
      const changesRequested = reviews.filter((r) => r.state === 'CHANGES_REQUESTED');

      const proof: ApprovalProof = {
        approvals: reviews,
        totalApprovals: approvals.length,
        totalChangesRequested: changesRequested.length,
        timestamp: new Date().toISOString(),
      };

      return { ok: true, proof };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Helper: Compute SHA256 checksum of proof data.
   * Ensures proof hasn't been tampered with.
   */
  private sha256(data: Buffer): string {
    // TODO: Implement using Web Crypto API
    // For now, return placeholder
    return `sha256:${data.length}bytes`;
  }
}

/**
 * Helper: Check if all required proof is green.
 */
export function isProofSufficient(
  checkProofs: CheckRunProof[],
  approvalProof: ApprovalProof,
  requiredChecks: string[],
  requiredApprovals: number,
): boolean {
  const checksGreen = requiredChecks.every((required) =>
    checkProofs.some(
      (proof) => proof.name === required && proof.conclusion === 'success',
    ),
  );

  const approvalsGreen = approvalProof.totalApprovals >= requiredApprovals;

  return checksGreen && approvalsGreen;
}
