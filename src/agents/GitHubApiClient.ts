/**
 * GitHubApiClient: GitHub REST API wrapper for agent workflows.
 *
 * Used by ReviewMergeAgent to:
 * - Fetch PR details (number, SHAs, state, mergeability)
 * - Get PR diff and reviews
 * - Check required status checks
 * - Merge PRs (with exact head verification)
 * - Post comments and check runs
 */

export interface GitHubPullRequest {
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string;
  head: {
    sha: string;
    ref: string;
  };
  base: {
    sha: string;
    ref: string;
  };
  mergeable: boolean;
  mergeable_state: string;
  merged: boolean;
  draft: boolean;
  user: {
    login: string;
  };
  requested_reviewers: Array<{ login: string }>;
  required_approvals: number;
  current_approvals: number;
}

export interface GitHubPullRequestDiff {
  files: Array<{
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
    patch: string;
  }>;
}

export interface GitHubCheckRun {
  name: string;
  status: 'completed' | 'in_progress' | 'queued';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | null;
  output: {
    title: string;
    summary: string;
    text?: string;
  };
}

export class GitHubApiClient {
  private baseUrl = 'https://api.github.com';
  private token: string;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Fetch pull request details.
   */
  async getPullRequest(prNumber: number): Promise<{
    ok: boolean;
    pr?: GitHubPullRequest;
    error?: string;
  }> {
    try {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/pulls/${prNumber}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `GitHub API error: ${response.status} ${response.statusText}`,
        };
      }

      const pr = (await response.json()) as GitHubPullRequest;
      return { ok: true, pr };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Fetch PR diff (list of changed files).
   */
  async getPullRequestDiff(prNumber: number): Promise<{
    ok: boolean;
    diff?: GitHubPullRequestDiff;
    error?: string;
  }> {
    try {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/pulls/${prNumber}/files?per_page=100`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `GitHub API error: ${response.status} ${response.statusText}`,
        };
      }

      const files = await response.json();
      return {
        ok: true,
        diff: { files },
      };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Get all check runs for a commit.
   */
  async getCheckRuns(commitSha: string): Promise<{
    ok: boolean;
    checks?: GitHubCheckRun[];
    error?: string;
  }> {
    try {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/commits/${commitSha}/check-runs`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `GitHub API error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        ok: true,
        checks: data.check_runs || [],
      };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Merge a PR.
   * Requires exact head SHA verification to prevent race conditions.
   */
  async mergePullRequest(
    prNumber: number,
    expectedHeadSha: string,
    options?: {
      commit_title?: string;
      commit_message?: string;
      merge_method?: 'merge' | 'squash' | 'rebase';
    },
  ): Promise<{
    ok: boolean;
    committed: boolean;
    sha?: string;
    error?: string;
  }> {
    try {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/pulls/${prNumber}/merge`;

      const payload = {
        commit_title: options?.commit_title || `Merge pull request #${prNumber}`,
        commit_message: options?.commit_message || '',
        merge_method: options?.merge_method || 'merge',
        sha: expectedHeadSha, // Verify exact head before merge
      };

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          ok: false,
          committed: false,
          error: error.message || `GitHub API error: ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        ok: true,
        committed: result.merged || false,
        sha: result.sha,
      };
    } catch (error) {
      return {
        ok: false,
        committed: false,
        error: String(error),
      };
    }
  }

  /**
   * Post a comment on a PR.
   */
  async postComment(prNumber: number, body: string): Promise<{
    ok: boolean;
    commentId?: number;
    error?: string;
  }> {
    try {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `GitHub API error: ${response.status}`,
        };
      }

      const comment = await response.json();
      return {
        ok: true,
        commentId: comment.id,
      };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  /**
   * Get PR reviews and approval status.
   */
  async getPullRequestReviews(prNumber: number): Promise<{
    ok: boolean;
    reviews?: Array<{
      user: { login: string };
      state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
      submitted_at: string;
    }>;
    approvalCount?: number;
    changesRequestedCount?: number;
    error?: string;
  }> {
    try {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/pulls/${prNumber}/reviews`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `GitHub API error: ${response.status}`,
        };
      }

      const reviews = await response.json();
      const approved = reviews.filter((r: any) => r.state === 'APPROVED').length;
      const changesRequested = reviews.filter((r: any) => r.state === 'CHANGES_REQUESTED').length;

      return {
        ok: true,
        reviews,
        approvalCount: approved,
        changesRequestedCount: changesRequested,
      };
    } catch (error) {
      return {
        ok: false,
        error: String(error),
      };
    }
  }
}
