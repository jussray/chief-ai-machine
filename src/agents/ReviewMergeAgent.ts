import { Agent, callable, routeAgentRequest } from 'agents';

/**
 * ReviewMergeAgent: Automated PR review, verification, and merge orchestration.
 *
 * Triggered by:
 * - GitHub PR event: opened, synchronize, ready_for_review
 * - GitHub comment: /review-merge
 *
 * Workflow:
 * 1. REPO_TRUTH: Bind to exact PR, branch, head SHA
 * 2. REVIEW: Analyze diff for correctness, regression, security, state transitions
 * 3. RUN_CHECKS: Type check, lint, unit tests, Playwright proof
 * 4. RED_TEAM: Trace failure paths, edge cases, production risks
 * 5. MERGE: Verify branch state, execute merge only with proof
 * 6. REPORT: Return REALITY/FIX/PROOF/RISK/ROLLBACK/NEXT GATE
 */

interface Env {
  [key: string]: any;
}

interface Connection {
  [key: string]: any;
}

export interface ReviewMergeState {
  prNumber: number;
  owner: string;
  repo: string;
  targetBranch: string;
  prHeadSha: string;
  prBaseSha: string;
  stage: 'pending' | 'binding' | 'reviewing' | 'checking' | 'redteaming' | 'merging' | 'completed' | 'failed';
  review: {
    correctness: { passed: boolean; findings: string[] };
    regression: { passed: boolean; findings: string[] };
    security: { passed: boolean; findings: string[] };
    stateTransitions: { passed: boolean; findings: string[] };
    failureHandling: { passed: boolean; findings: string[] };
  } | null;
  checks: {
    typecheck: { status: 'pending' | 'passed' | 'failed'; output: string };
    lint: { status: 'pending' | 'passed' | 'failed'; output: string };
    tests: { status: 'pending' | 'passed' | 'failed'; output: string };
    playwright: { status: 'pending' | 'passed' | 'failed'; evidence: string };
    requiredChecks: { [name: string]: boolean };
  } | null;
  redteamFindings: string[];
  mergeability: {
    isMergeable: boolean;
    conflicts: string[];
    requiredApprovalsCount: number;
    currentApprovalsCount: number;
  } | null;
  merged: boolean;
  mergedCommitSha: string;
  report: string;
  errors: string[];
}

export class ReviewMergeAgent extends Agent<Env, ReviewMergeState> {
  initialState: ReviewMergeState = {
    prNumber: 0,
    owner: '',
    repo: '',
    targetBranch: '',
    prHeadSha: '',
    prBaseSha: '',
    stage: 'pending',
    review: null,
    checks: null,
    redteamFindings: [],
    mergeability: null,
    merged: false,
    mergedCommitSha: '',
    report: '',
    errors: [],
  };

  async onConnect(connection: Connection) {
    if (this.state.stage === 'pending' && this.state.prNumber > 0) {
      this.startWorkflow();
    }
  }

  async startWorkflow() {
    try {
      // 1. REPO_TRUTH: Bind to exact PR state
      this.setState({ stage: 'binding' });
      // TODO: In production, env is available from Cloudflare Durable Object context
      const prBinding = await this.bindToPullRequest();
      if (!prBinding.ok) {
        throw new Error(`PR binding failed: ${prBinding.error}`);
      }

      this.setState({
        prHeadSha: prBinding.headSha,
        prBaseSha: prBinding.baseSha,
        targetBranch: prBinding.targetBranch,
      });

      // 2. REVIEW: Analyze diff
      this.setState({ stage: 'reviewing' });
      const review = await this.analyzeDiff();
      this.setState({ review });

      // 3. RUN_CHECKS: Type check, lint, tests
      this.setState({ stage: 'checking' });
      const checks = await this.runAllChecks();
      this.setState({ checks });

      // 4. RED_TEAM: Identify failure paths
      this.setState({ stage: 'redteaming' });
      const redteamFindings = await this.redteamFailurePaths();
      this.setState({ redteamFindings });

      // Check if safe to merge
      const canMerge = this.canSafelyMerge();
      if (!canMerge.ok) {
        this.setState({
          stage: 'failed',
          report: `Merge blocked: ${canMerge.reason}`,
        });
        return;
      }

      // 5. MERGE: Execute merge if authorized
      this.setState({ stage: 'merging' });
      const mergeResult = await this.executeMerge();
      if (mergeResult.ok) {
        this.setState({
          merged: true,
          mergedCommitSha: mergeResult.commitSha,
        });
      } else {
        throw new Error(`Merge failed: ${mergeResult.error}`);
      }

      // 6. REPORT
      const report = this.generateReport();
      this.setState({
        report,
        stage: 'completed',
      });

      this.broadcast({
        type: 'review_merge_completed',
        merged: this.state.merged,
        state: this.state,
      });
    } catch (error) {
      this.setState({
        stage: 'failed',
        errors: [...this.state.errors, String(error)],
        report: `Review/Merge failed: ${error}`,
      });

      this.broadcast({
        type: 'review_merge_failed',
        error: String(error),
      });
    }
  }

  private async bindToPullRequest() {
    // Fetch PR from GitHub, verify exact head state and mergeability
    // Binding captures authoritative state to guard against race conditions

    const { GitHubApiClient } = await import('./GitHubApiClient.js');

    // TODO: In production, GITHUB_TOKEN comes from Cloudflare environment
    const token = process.env.GITHUB_TOKEN || '';
    if (!token) {
      return {
        ok: false,
        error: 'GITHUB_TOKEN not configured',
        headSha: '',
        baseSha: '',
        targetBranch: '',
      };
    }

    const client = new GitHubApiClient(token, this.state.owner, this.state.repo);
    const prResult = await client.getPullRequest(this.state.prNumber);

    if (!prResult.ok || !prResult.pr) {
      return {
        ok: false,
        error: prResult.error,
        headSha: '',
        baseSha: '',
        targetBranch: '',
      };
    }

    const pr = prResult.pr;

    // Fetch reviews for approval count
    const reviewsResult = await client.getPullRequestReviews(this.state.prNumber);

    // Verify mergeability
    const canMerge = {
      isMergeable: pr.mergeable,
      conflicts: pr.mergeable_state === 'dirty' ? ['Merge conflicts detected'] : [],
      requiredApprovalsCount: pr.required_approvals || 1,
      currentApprovalsCount: reviewsResult.approvalCount || 0,
    };

    this.setState({
      mergeability: canMerge,
      bottleneck: {
        ...this.state.bottleneck,
        evidence: [
          ...this.state.bottleneck.evidence,
          `PR #${this.state.prNumber}: ${pr.title}`,
          `State: ${pr.state}, Draft: ${pr.draft}`,
          `Head: ${pr.head.sha.substring(0, 7)} (${pr.head.ref})`,
          `Base: ${pr.base.sha.substring(0, 7)} (${pr.base.ref})`,
          `Mergeable: ${pr.mergeable}, Status: ${pr.mergeable_state}`,
          `Approvals: ${canMerge.currentApprovalsCount}/${canMerge.requiredApprovalsCount}`,
        ],
      },
    });

    return {
      ok: true,
      headSha: pr.head.sha,
      baseSha: pr.base.sha,
      targetBranch: pr.base.ref,
    };
  }

  private async analyzeDiff() {
    // Analyze PR diff for correctness, regression risk, security, state transitions
    return {
      correctness: { passed: true, findings: [] },
      regression: { passed: true, findings: [] },
      security: { passed: true, findings: [] },
      stateTransitions: { passed: true, findings: [] },
      failureHandling: { passed: true, findings: [] },
    };
  }

  private async runAllChecks() {
    return {
      typecheck: { status: 'pending' as const, output: '' },
      lint: { status: 'pending' as const, output: '' },
      tests: { status: 'pending' as const, output: '' },
      playwright: { status: 'pending' as const, evidence: '' },
      requiredChecks: {},
    };
  }

  private async redteamFailurePaths() {
    // Red-team the change: what could fail in production despite green tests?
    return [
      'Edge case: concurrent writes to same resource',
      'Race condition: timing-dependent state',
      'Provider failure: what if GitHub API times out mid-merge?',
    ];
  }

  private canSafelyMerge() {
    const { review, checks, redteamFindings, mergeability } = this.state;
    const hasFailures = Object.values(review?.correctness?.findings || {}).some(f => f);
    const checksGreen = Object.values(checks?.requiredChecks || {}).every(v => v);
    const noBlockers = redteamFindings.length === 0;

    if (hasFailures || !checksGreen) {
      return { ok: false, reason: 'Failing review or checks' };
    }

    if (noBlockers === false) {
      return { ok: false, reason: 'Red-team findings unresolved' };
    }

    return { ok: true };
  }

  private async executeMerge() {
    // Call GitHub merge API with exact head SHA verification
    // TODO: Integrate with GitHub API
    return {
      ok: true,
      commitSha: 'TODO',
    };
  }

  private generateReport() {
    return `
# Review & Merge Report

**PR:** ${this.state.owner}/${this.state.repo}#${this.state.prNumber}
**Target Branch:** ${this.state.targetBranch}
**Head SHA:** ${this.state.prHeadSha}
**Base SHA:** ${this.state.prBaseSha}

## Reality
Status: ${this.state.merged ? '✅ Merged' : '⏳ Pending'}

## Review Results
- Correctness: ${this.state.review?.correctness.passed ? '✅' : '❌'}
- Regression: ${this.state.review?.regression.passed ? '✅' : '❌'}
- Security: ${this.state.review?.security.passed ? '✅' : '❌'}
- State Transitions: ${this.state.review?.stateTransitions.passed ? '✅' : '❌'}
- Failure Handling: ${this.state.review?.failureHandling.passed ? '✅' : '❌'}

## Checks
- Type Check: ${this.state.checks?.typecheck.status || 'pending'}
- Lint: ${this.state.checks?.lint.status || 'pending'}
- Tests: ${this.state.checks?.tests.status || 'pending'}
- Playwright: ${this.state.checks?.playwright.status || 'pending'}

## Red-Team Findings
${this.state.redteamFindings.length > 0 ? this.state.redteamFindings.map(f => `- ${f}`).join('\n') : 'None'}

## Rollback
\`git revert ${this.state.merged ? this.state.mergedCommitSha : 'N/A'}\`

## Next Gate
${this.state.merged ? 'Deploy and monitor' : 'Address findings and re-run'}
    `.trim();
  }

  @callable()
  initiatePullRequestReview(prNumber: number, owner: string, repo: string) {
    this.setState({
      prNumber,
      owner,
      repo,
    });
    this.startWorkflow();
    return { started: true, pr: `${owner}/${repo}#${prNumber}` };
  }

  @callable()
  getReviewStatus() {
    return {
      stage: this.state.stage,
      pr: `${this.state.owner}/${this.state.repo}#${this.state.prNumber}`,
      merged: this.state.merged,
      report: this.state.report,
    };
  }
}

export default {
  async fetch(req: Request, env: Env) {
    return routeAgentRequest(req, env) ?? new Response('Not found', { status: 404 });
  },
};
