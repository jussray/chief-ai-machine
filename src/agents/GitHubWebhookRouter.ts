import crypto from 'crypto';

/**
 * GitHubWebhookRouter: Routes GitHub events to appropriate agents.
 *
 * Webhook Events Handled:
 * - pull_request (opened, synchronize, ready_for_review)
 * - issue_comment (goalfix, review-merge commands)
 * - push (trigger deployments)
 *
 * Security:
 * - Verify HMAC-SHA256 signature from GitHub
 * - Only dispatch authenticated events
 */

export interface GitHubWebhookEvent {
  action?: string;
  pull_request?: {
    number: number;
    head: { sha: string };
    base: { ref: string };
    state: string;
  };
  issue?: {
    number: number;
    pull_request?: { url: string };
  };
  comment?: {
    body: string;
    user: { login: string };
  };
  repository?: {
    owner: { login: string };
    name: string;
  };
  push?: {
    ref: string;
    commits: Array<{ id: string; message: string }>;
  };
}

export class GitHubWebhookRouter {
  private webhookSecret: string;

  constructor(webhookSecret: string) {
    this.webhookSecret = webhookSecret;
  }

  /**
   * Verify GitHub webhook signature.
   * GitHub sends X-Hub-Signature-256 header with HMAC-SHA256(secret, body).
   */
  verifySignature(body: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');
    const expectedSignature = `sha256=${hash}`;
    return crypto.timingSafeEqual(expectedSignature, signature);
  }

  /**
   * Parse and route GitHub webhook event to appropriate agent.
   */
  async routeEvent(
    event: GitHubWebhookEvent,
    env: Env,
  ): Promise<{ dispatched: string; target: string; action: string }> {
    // Pull Request events
    if (event.pull_request) {
      const pr = event.pull_request;
      const repo = event.repository;

      if (['opened', 'synchronize', 'ready_for_review'].includes(event.action || '')) {
        // Trigger ReviewMergeAgent for PR review
        const agentId = `${repo?.owner.login}/${repo?.name}#${pr.number}`;
        return {
          dispatched: 'ReviewMergeAgent',
          target: agentId,
          action: `review_pr_${event.action}`,
        };
      }
    }

    // Issue comment events (issue or PR comment)
    if (event.issue && event.comment && event.repository) {
      const commentBody = event.comment.body;
      const repo = event.repository;
      const prNumber = event.issue.number;

      // /goalfix <goal>
      if (commentBody.includes('/goalfix')) {
        const goal = commentBody.replace('/goalfix', '').trim();
        const agentId = `${repo.owner.login}/${repo.name}#${prNumber}`;
        return {
          dispatched: 'GoalFixAgent',
          target: agentId,
          action: `goalfix_${goal.substring(0, 20)}`,
        };
      }

      // /review-merge
      if (commentBody.includes('/review-merge')) {
        const agentId = `${repo.owner.login}/${repo.name}#${prNumber}`;
        return {
          dispatched: 'ReviewMergeAgent',
          target: agentId,
          action: 'review_merge_command',
        };
      }
    }

    // Push events
    if (event.push) {
      // Could trigger deployment agents here
      return {
        dispatched: 'None',
        target: 'N/A',
        action: 'push_event_logged',
      };
    }

    return {
      dispatched: 'None',
      target: 'N/A',
      action: 'event_not_routed',
    };
  }
}

/**
 * Handle incoming GitHub webhook.
 * Verify signature, parse event, dispatch to agents.
 */
export async function handleGitHubWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('X-Hub-Signature-256');
  if (!signature || !env.GITHUB_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.text();
  const router = new GitHubWebhookRouter(env.GITHUB_WEBHOOK_SECRET);

  if (!router.verifySignature(body, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const event: GitHubWebhookEvent = JSON.parse(body);
  const dispatch = await router.routeEvent(event, env);

  if (dispatch.dispatched !== 'None') {
    // TODO: Actually dispatch to agent
    // const agent = env[dispatch.dispatched];
    // await agent.get(dispatch.target).call(dispatch.action, event);
  }

  return Response.json(dispatch);
}
