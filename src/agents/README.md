# Chief AI Agents

Production agents for Founder Control Room automation, repo auditing, and PR review/merge orchestration.

## Architecture

```
GitHub Events (webhooks)
    ↓
/webhook/github → GitHubWebhookRouter
    ↓
    ├─ pull_request → ReviewMergeAgent
    ├─ issue_comment (/goalfix) → GoalFixAgent
    └─ issue_comment (/review-merge) → ReviewMergeAgent
    ↓
Durable Objects (persistent state)
    ↓
Cloudflare Workers (execution)
```

## Agents

### GoalFixAgent

**Purpose:** Automated repo audit → bottleneck identification → focused fix → verification.

**Triggered by:**
- GitHub PR comment: `/goalfix <goal>`
- Direct API: `POST /agents/goalfix/{instance-id}`

**Workflow:**
1. **OBSERVE** — Clone repo, inspect branch, gather evidence
2. **AUDIT** — Identify bottleneck (verified/inferred/unknown)
3. **FIX** — Apply smallest reversible patch
4. **VERIFY** — Run type checks, tests, Playwright proof
5. **REPORT** — Return REALITY/FIX/PROOF/RISK/ROLLBACK/NEXT GATE

**State:**
- `goal`, `repoUrl`, `targetBranch`, `baseSha`, `headSha`
- `stage` — pending|observing|auditing|fixing|verifying|completed|failed
- `bottleneck` — classification, description, evidence
- `fixApplied` — files changed, commit, reversible flag
- `verificationResults` — typecheck, tests, playwright proof
- `report` — full markdown report

**Callable Methods:**
- `setGoal(goal, repoUrl, targetBranch)` — Start workflow
- `getStatus()` — Current stage & results

**Status:**
- ✅ Agent skeleton complete
- 🔄 Integration needed: repo-truth, repo cloning, actual bottleneck analysis
- 🔄 Integration needed: typecheck, test runner, git operations
- 🔄 Integration needed: Playwright proof capture

### ReviewMergeAgent

**Purpose:** Automated PR review orchestration, verification, and safe merge execution.

**Triggered by:**
- GitHub PR event: opened, synchronize, ready_for_review
- GitHub comment: `/review-merge`

**Workflow:**
1. **REPO_TRUTH** — Bind to exact PR, branch, head SHA
2. **REVIEW** — Analyze diff for correctness, regression, security, state transitions
3. **RUN_CHECKS** — Type check, lint, unit tests, Playwright proof
4. **RED_TEAM** — Trace failure paths, edge cases, production risks
5. **MERGE** — Verify branch state, execute merge only with proof
6. **REPORT** — Return REALITY/FIX/PROOF/RISK/ROLLBACK/NEXT GATE

**State:**
- `prNumber`, `owner`, `repo`, `targetBranch`, `prHeadSha`, `prBaseSha`
- `stage` — pending|binding|reviewing|checking|redteaming|merging|completed|failed
- `review` — correctness, regression, security, state transitions, failure handling
- `checks` — typecheck, lint, tests, playwright, required checks dict
- `redteamFindings` — list of uncovered failure paths
- `mergeability` — isMergeable, conflicts, approvals
- `merged`, `mergedCommitSha`, `report`

**Callable Methods:**
- `initiatePullRequestReview(prNumber, owner, repo)` — Start workflow
- `getReviewStatus()` — Current stage & results

**Status:**
- ✅ Agent skeleton complete
- 🔄 Integration needed: GitHub PR diff fetching and analysis
- 🔄 Integration needed: type check, lint, test execution
- 🔄 Integration needed: red-team failure path analysis
- 🔄 Integration needed: GitHub merge API integration
- 🔄 Integration needed: Playwright proof for UI changes

## GitHub Webhook Integration

### Setup

1. Register webhook in GitHub repo settings:
   - **Payload URL:** `https://chief-ai.example.com/webhook/github`
   - **Content type:** `application/json`
   - **Secret:** Set `GITHUB_WEBHOOK_SECRET` in Cloudflare environment

2. Subscribe to events:
   - `pull_request` (opened, synchronize, ready_for_review)
   - `issue_comment` (for /goalfix, /review-merge commands)
   - `push` (for deployment automation)

### Security

- All webhooks verified with HMAC-SHA256 signature
- `X-Hub-Signature-256` header required
- Timing-safe comparison prevents timing attacks
- Failed verification → 401 Unauthorized

## Deployment

### Install dependencies

```bash
npm install agents @cloudflare/ai-chat ai @ai-sdk/react
```

### Local development

```bash
npm run dev:agents
# Starts wrangler dev server on localhost:8787
# POST http://localhost:8787/webhook/github to test
# GET http://localhost:8787/agents/goalfix/test-id to access agent
```

### Deploy to Cloudflare

```bash
npm run deploy:agents
# Deploys worker + Durable Objects to production
# Sets up SQLite migrations automatically
```

### Environment Variables

Set in Cloudflare dashboard or `wrangler.toml`:

```
GITHUB_WEBHOOK_SECRET=<github_webhook_secret>
GITHUB_TOKEN=<personal_access_token>
GITHUB_APP_ID=<optional_app_id>
PLAYWRIGHT_API_URL=<playwright_connect_url>
```

## Integration Gaps (Next Steps)

### GoalFixAgent

1. **Repo Operations**
   - Integrate `repo-truth` skill for accurate repo state binding
   - Clone/fetch repo at exact base SHA
   - Identify target branch and capture diffs

2. **Bottleneck Analysis**
   - Run typecheck, lint, tests to gather evidence
   - Apply ULTRATHINK/Product Design/Redteam I reasoning
   - Classify bottleneck with evidence

3. **Fix Application**
   - Generate minimal reversible patch
   - Create git commit with proper attribution
   - Verify reversible (can be reverted cleanly)

4. **Verification**
   - Execute typecheck, lint, tests on fixed code
   - Run Playwright proof for UI changes
   - Ensure all checks pass before reporting

### ReviewMergeAgent

1. **PR State Binding**
   - Fetch PR from GitHub API
   - Verify exact head/base SHAs
   - Check mergeability status

2. **Code Review Analysis**
   - Fetch PR diff
   - Analyze for correctness, regression, security, state transitions
   - Return structured findings

3. **Check Orchestration**
   - Run typecheck, lint, unit tests
   - Capture Playwright proof for UI
   - Verify all required checks pass

4. **Red-Team Analysis**
   - Trace failure paths (what could fail in prod?)
   - Identify edge cases and race conditions
   - Review error handling paths

5. **Merge Execution**
   - Verify PR still mergeable
   - Check required approvals
   - Execute GitHub merge API
   - Verify merge succeeded

### PlaywrightProofClient

1. **Browser Integration**
   - Connect to Cloudflare Browser Rendering or Playwright Connect
   - Navigate to URLs, capture screenshots
   - Record console messages, network errors

2. **User Journey Support**
   - Click, fill, submit forms
   - Wait for async operations
   - Verify page state after interactions

3. **Screenshot Capture**
   - Multiple widths: 375px (mobile), 768px (tablet), 1440px (desktop)
   - Compare before/after for regressions
   - Archive evidence in R2 or IPFS

## Testing

```bash
npm test
# Runs vitest on agent implementations
```

## Observability

Agents emit diagnostics-channel events:

- `agent:state_change` — State updates
- `agent:callable_invoked` — RPC method calls
- `agent:schedule_created` — Scheduled tasks
- `agent:error` — Exceptions and failures

Monitor via Cloudflare Logpush or local listener.

## Roadmap

- [ ] Integrate agents-sdk MCP client for connecting to Founder Control Room MCP server
- [ ] Add workflow support for complex multi-step repairs
- [ ] Implement durable fiber support for long-running audits
- [ ] Add retry with exponential backoff for transient failures
- [ ] Build React client hooks for real-time agent status
- [ ] Support email triggers for agent workflows
- [ ] Add voice support for audit narration
- [ ] Build Slack notifications for agent progress

## References

- [Agents SDK Docs](https://developers.cloudflare.com/agents/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Founder Control Room CLAUDE.md](/CLAUDE.md)
- [Review Verify Merge Skill](/.claude/skills/review-verify-merge/SKILL.md)
- [GoalFix Skill](/.claude/skills/goalfix/SKILL.md)
