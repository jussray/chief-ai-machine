/**
 * FounderControlRoomClient: Query Founder Control Room for authority & governance.
 *
 * Every consequential agent decision requires founder approval or matching policy:
 * - Merge authority: Is founder willing to auto-merge this PR category?
 * - Audit authority: Which repos can agent audit?
 * - Proof policy: What evidence is sufficient for automatic action?
 *
 * Agent role: Coordinator. Requests authority, respects decisions, logs outcomes.
 * Founder role: Authority. Sets policies, approves exceptions, reviews actions.
 */

export interface MergePolicy {
  allowAutoMerge: boolean;
  requireApprovals: number;
  requireAllChecksGreen: boolean;
  requirePlaywrightProof: boolean;
  allowedBranches: string[];
  blockedRepos: string[];
  requireExplicitApprovalFor: string[];
}

export interface AuditAuthority {
  canAudit: boolean;
  allowedRepos: string[];
  maxConcurrentAudits: number;
}

export interface ProofPolicy {
  requiredChecksPassed: string[];
  minimumApprovals: number;
  requirePlaywrightScreenshots: boolean;
  acceptableTestCoverage: number;
}

export class FounderControlRoomClient {
  private fcrUrl: string;
  private fcrToken: string;

  constructor(fcrUrl: string, fcrToken: string) {
    this.fcrUrl = fcrUrl;
    this.fcrToken = fcrToken;
  }

  /**
   * Query merge policy: Is automatic merge allowed for this PR?
   *
   * Returns founder-configured policy. Agent never decides unilaterally.
   */
  async getMergePolicy(owner: string, repo: string): Promise<{
    ok: boolean;
    policy?: MergePolicy;
    error?: string;
  }> {
    try {
      const url = `${this.fcrUrl}/api/governance/merge-policy`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.fcrToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner, repo }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `FCR policy fetch failed: ${response.status}`,
        };
      }

      const policy = await response.json();
      return { ok: true, policy };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Query audit authority: Can agent audit this repo?
   */
  async getAuditAuthority(owner: string, repo: string): Promise<{
    ok: boolean;
    authority?: AuditAuthority;
    error?: string;
  }> {
    try {
      const url = `${this.fcrUrl}/api/governance/audit-authority`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.fcrToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner, repo }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `FCR authority fetch failed: ${response.status}`,
        };
      }

      const authority = await response.json();
      return { ok: true, authority };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Record merge decision in FCR audit log.
   *
   * Creates immutable record: agent requested merge, founder policy was checked, outcome recorded.
   */
  async recordMergeDecision(
    owner: string,
    repo: string,
    prNumber: number,
    decision: {
      action: 'merge' | 'skip' | 'wait_for_approval';
      proofStatus: 'green' | 'yellow' | 'red';
      policyMatched: boolean;
      reason: string;
      timestamp: string;
    },
  ): Promise<{
    ok: boolean;
    recordId?: string;
    error?: string;
  }> {
    try {
      const url = `${this.fcrUrl}/api/audit/merge-decision`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.fcrToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          prNumber,
          ...decision,
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `FCR decision recording failed: ${response.status}`,
        };
      }

      const result = await response.json();
      return { ok: true, recordId: result.recordId };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Record audit findings in FCR.
   *
   * Creates immutable record of what agent discovered: bottleneck, evidence, fix recommendation.
   */
  async recordAuditFindings(
    owner: string,
    repo: string,
    branch: string,
    findings: {
      bottleneck: string;
      evidence: string[];
      fixRecommendation: string;
      reversible: boolean;
      timestamp: string;
    },
  ): Promise<{
    ok: boolean;
    findingsId?: string;
    error?: string;
  }> {
    try {
      const url = `${this.fcrUrl}/api/audit/findings`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.fcrToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          ...findings,
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `FCR findings recording failed: ${response.status}`,
        };
      }

      const result = await response.json();
      return { ok: true, findingsId: result.findingsId };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Get proof policy: What evidence level is required for automatic action?
   */
  async getProofPolicy(owner: string, repo: string): Promise<{
    ok: boolean;
    policy?: ProofPolicy;
    error?: string;
  }> {
    try {
      const url = `${this.fcrUrl}/api/governance/proof-policy`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.fcrToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner, repo }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `FCR proof policy fetch failed: ${response.status}`,
        };
      }

      const policy = await response.json();
      return { ok: true, policy };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }
}
