# Chief AI Agents

**Honest Path:** Agents are coordinators, not autonomous executors.

- Query founder authority before any action
- Capture real, verifiable proof (not stubs)
- Record all decisions in Founder Control Room audit log
- Respect governance gates (merge policy, approval requirements)
- Call external services for operations that require subprocess/git

Production agents for Founder Control Room automation, repo auditing, and PR review/merge orchestration.

## Architecture

```
GitHub Events (webhooks)
    ↓
/webhook/github → GitHubWebhookRouter [HMAC-SHA256 verified]
    ↓
    ├─ pull_request → ReviewMergeAgent
    ├─ issue_comment (/goalfix) → GoalFixAgent
    └─ issue_comment (/review-merge) → ReviewMergeAgent
    ↓
Durable Objects (persistent state, SQLite)
    ↓
Coordinator logic (decide based on proof + policy)
    ├─ Query GitHub API (PR state, diffs, approvals, checks)
    ├─ Query Founder Control Room (merge policy, audit authority)
    ├─ Capture proof (real evidence: GitHub API results, Playwright screenshots)
    ├─ Check proof meets policy (proof green? policy allows?)
    └─ Record decision (immutable log in FCR)
    ↓
External Services (for operations Workers can't do)
    ├─ Git operations (clone, patch, verify) → External Git service
    ├─ Playwright proof (screenshots, browser automation) → Cloudflare Browser
    └─ Check execution (typecheck, tests) → GitHub Actions API
```

## Design Principles

### Agent as Coordinator, Not Executor

**❌ Old design (broken):**
```
Agent receives webhook
  → Agent clones repo (no git in Workers!)
  → Agent applies patch (no git in Workers!)
  → Agent runs tests (no shell in Workers!)
  → Agent decides to merge (no governance!)
```

**✅ New design (honest):**
```
Agent receives webhook
  → Query GitHub API for PR state (real evidence)
  → Query Founder Control Room for merge policy (governance)
  → Capture proof: GitHub check runs, Playwright screenshots (real data)
  → Check: proof green? policy allows? 
  → Record decision in FCR audit log (immutable)
  → Call external service for operations that require subprocess
```

### What Workers Can Do ✅

- Receive webhooks (HMAC-SHA256 verified)
- Maintain state (SQLite via Durable Objects)
- Call external APIs (GitHub, FCR)
- Make routing decisions
- Record audit logs

### What Workers Cannot Do ❌

- Git operations (no git binary, no filesystem)
- Subprocess execution (no shell)
- Long-running operations (10-minute timeout)
- Direct filesystem access (ephemeral)

**Solution:** Call external services for these. Mark clearly as "coordinator calls external."

---

## Agents

### GoalFixAgent

**Purpose:** Coordinate repo audit → bottleneck identification → recommend fix (doesn't apply it).

**Triggered by:**
- GitHub PR comment: `/goalfix <goal>`
- Direct API: `POST /agents/goalfix/{instance-id}`

**Workflow:**
1. **OBSERVE** — Call external Git service to clone repo, get exact state
2. **AUDIT** — Analyze logs/errors to identify bottleneck (verified/inferred/unknown)
3. **RECOMMEND** — Suggest smallest reversible patch (doesn't apply it)
4. **VERIFY** — Query external service for test/typecheck results
5. **RECORD** — Log findings in Founder Control Room
6. **REPORT** — Return REALITY/FIX/PROOF/RISK/ROLLBACK/NEXT GATE

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

**Purpose:** Coordinate PR review with governance → merge only if founder policy + proof green.

**Triggered by:**
- GitHub PR event: opened, synchronize, ready_for_review
- GitHub comment: `/review-merge`

**Workflow:**
1. **REPO_TRUTH** — Bind to exact PR (fetch from GitHub API, not assumption)
2. **QUERY GOVERNANCE** — Check merge policy from Founder Control Room
3. **REVIEW** — Analyze diff for correctness, regression, security
4. **CAPTURE PROOF** — Get real evidence from GitHub (check runs, approvals, diffs)
5. **VERIFY PROOF** — Check proof meets founder policy (all required checks green? enough approvals?)
6. **RED_TEAM** — Identify failure paths
7. **DECISION** — Can merge? = (proof green) AND (policy allows) → Record in FCR
8. **MERGE** — Execute merge if and only if authorized
9. **REPORT** — Return REALITY/FIX/PROOF/RISK/ROLLBACK/NEXT GATE

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

## Governance Integration

### Founder Control Room Authority

Every agent action requires founder approval or matching policy:

```typescript
// Query merge policy
const policy = await fcr.getMergePolicy(owner, repo);
// Returns: allowAutoMerge, requireApprovals, requireAllChecksGreen, etc.

// Check if proof meets policy
if (!policy.allowAutoMerge || !proofSufficient) {
  // Wait for approval, don't merge
}

// Record decision in audit log
await fcr.recordMergeDecision(owner, repo, prNumber, {
  action: 'merge' | 'skip' | 'wait_for_approval',
  proofStatus: 'green' | 'yellow' | 'red',
  policyMatched: boolean,
  reason: string,
  timestamp: string,
});
```

### Proof Requirements

Agent merges ONLY if:
- ✅ Proof green (all required checks pass)
- ✅ Policy allows (founder configured auto-merge for this repo)
- ✅ Recorded in FCR (immutable audit log)

---

## External Services

### Git Operations

**Current:** Stubs (marked clearly as "external service only")

**What's needed:** External service that can:
- Clone repo at exact SHA
- Apply patches
- Run git commands (typecheck, tests)
- Verify reversibility

**Options:**
1. GitHub Actions API (run commands in CI)
2. Temporal workflow (long-running async jobs)
3. Render/Railway (containerized git environment)

**Agent responsibility:** Request operation, wait for result, capture proof

### Playwright Proof

**Current:** Interface defined (capturePlaywrightProof)

**What's needed:** Browser automation that can:
- Navigate to URL
- Capture screenshots at multiple widths (375px, 768px, 1440px)
- Record console errors
- Verify page state

**Options:**
1. Cloudflare Browser Rendering (experimental)
2. Playwright Connect (remote browser server)
3. Headless Chrome API

**Agent responsibility:** Request proof, store in R2, reference in report

### Typecheck/Tests/Lint

**Current:** Calls GitHub API to fetch check runs (real evidence)

**What's needed:** Check runs must already exist (from GitHub Actions)

**Agent responsibility:** Fetch results from GitHub API, verify against policy

---

## Integration Gaps (Next Steps)

### What's Done ✅

1. **Agent scaffolding** — State machine, webhook routing, callable methods
2. **GitHub API integration** — Fetch PR state, diffs, approvals, check runs (real evidence)
3. **Founder Control Room integration** — Query policy, record decisions (governance)
4. **Proof capture interface** — Capture real evidence from GitHub + Playwright
5. **Coordinator logic** — Decide based on proof + policy, not autonomously

### What's Needed 🔄

#### GoalFixAgent

1. **External Git service integration**
   - Call external service to clone repo at exact base SHA
   - Request patch application (doesn't run in Worker)
   - Fetch verification results (typecheck, tests, diffs)

2. **Bottleneck analysis (Claude)**
   - Send logs/errors to Claude API for ULTRATHINK analysis
   - Return bottleneck classification + evidence
   - Generate fix recommendation

3. **Proof storage**
   - Store analysis results in R2
   - Link evidence in audit log

#### ReviewMergeAgent

1. **FCR policy enforcement** ✅ Already integrated
   - Query merge policy before deciding
   - Record all decisions in FCR
   - Respect founder authority

2. **Real proof capture** ✅ Interfaces defined
   - GitHub API for check runs (already integrated)
   - Playwright for screenshots (awaits browser integration)
   - Coverage/lint results (fetch from GitHub API)

3. **Red-team analysis (Claude)**
   - Send diff to Claude for failure path analysis
   - Identify risks, edge cases, error handling gaps

#### PlaywrightProofClient

1. **Browser integration** 🔄
   - Connect to Cloudflare Browser Rendering
   - Or Playwright Connect remote browser
   - Navigate, capture screenshots, record console

2. **Proof storage**
   - Store screenshots in R2 (signed, checksummed)
   - Reference in agent report

3. **Regression detection**
   - Compare before/after screenshots
   - Flag visual changes

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
