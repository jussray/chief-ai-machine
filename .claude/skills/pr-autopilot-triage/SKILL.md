# PR Autopilot Triage

**Purpose**: Automatically classify, investigate, and resolve stale or blocked PRs using /goalfix + evidence-decision-loop methodology.

**When to use**: 
- Single PR investigation: `/pr-autopilot <PR-number>`
- Batch PR triage: `/pr-autopilot-batch <144,152,204>`
- Routine audit finds unmerged PR >7 days old

## Workflow

### 1. Classify (Observe)
Check PR state:
- **Superseded**: Work already merged under different PR/commit
- **Mergeable**: Can cherry-pick or rebase cleanly
- **Blocked**: Architectural history conflicts, unresolved dependencies
- **Invalid**: No branch, work abandoned, reference error

### 2. Investigate (Orient)
For each classification:
- **Superseded**: Search main for equivalent commits, verify work is complete
- **Mergeable**: Run test suite against branch, check for merge conflicts
- **Blocked**: Document root cause (unrelated history, missing base, etc.)
- **Invalid**: Determine why (branch deleted, PR closed, reference unclear)

### 3. Route & Implant (Decide & Act)
Based on classification:
- **Superseded** → Close PR, document evidence (commits found in main), mark as resolved
- **Mergeable** → Cherry-pick clean commits or rebase+merge, push to origin
- **Blocked** → Document blocker, propose rebase strategy or suggest close
- **Invalid** → Report not found, ask for clarification or close as invalid

### 4. Report (Verify)
For each PR:
- **Status**: MERGED | CLOSED | BLOCKED | NOT_FOUND
- **Evidence**: Specific commits found, test results, merge strategy used
- **Outcome**: PR resolved or next action required

## Implementation Notes

- Uses /goalfix methodology: smallest verified fix, evidence-based decisions
- Searches commit history before attempting merge (catches superseded work)
- Cherry-pick strategy for blocked PRs (salvage usable work)
- Evidence-first reporting (cite specific commits, test results)
- No speculative fixes—only act on verified findings

## Example Usage

```bash
/pr-autopilot 144
# → Searches main for browser-reality work
# → Finds commits a94d0b0, dfc1b73 in main
# → Reports: SUPERSEDED (work merged in main)
# → Closes PR as resolved

/pr-autopilot-batch 144,152,204,77
# → Triages all four PRs in parallel
# → Reports status matrix with evidence
# → Proposes actions for each
```

## Integration with Portfolio

Used in routine audits to keep portfolio PRs synchronized:
- Detects when PR work is already merged (avoids duplicate effort)
- Clears stale PR branches (workspace hygiene)
- Surfaces genuinely blocked work (requires human decision)
- Maintains evidence trail (commit-level traceability)

## Token Efficiency

Optimized for token budget:
- Search → classify → report (single pass where possible)
- Batch processing (parallel investigation of multiple PRs)
- Narrow searches (target specific commits, not full history)
- Evidence-only output (no speculation or re-analysis)

## Exact-head auto-update and automatic fix integration (v1)

Reuse the existing carrier. The repo's `.github/workflows/founder-safe-pr-refresh.yml` runs a scheduled/push-triggered scan for same-repo, founder-authored, `juss-auto-update`-labeled PRs, with a maximum five API branch refresh requests per run. It uses GitHub's `PUT /pulls/{number}/update-branch` guarded by `expected_head_sha`; never reinterpret a new commit as approval of an earlier candidate.

When a refresh is blocked by a conflict, or a new current-head test fails: use the existing `.github/agents/reds-implant.agent.md` and `.agents/skills/goalfix/SKILL.md` to inspect exact logs, repair only the concrete cause on the same PR, and re-verify. GitHub's Agent Merge can perform automatic conflict/test-failure repair **only if separately enabled with eligible Copilot licensing and consent**; this skill file itself cannot start that paid service or prove it ran.

Native auto-merge is a separate, explicit, founder-dispatched action. Require the exact repo, PR, base and head SHA and the typed approval phrase; only arm the current non-draft PR after policy review. Never auto-arm when a branch refresh, skill execution, issue comment, CI passing, or `cont` occurs. GitHub branch protection, required review, real-path proof, security checks and founder authority all remain independent gates. Stop and label BLOCKED on missing or stale evidence rather than completing a merge by bypassing the gate.

Audit depth: founder value → Lindy → Red Team I → L99 → Red Team II / Devil → OODA → Goalfix → test and Playwright where applicable → review. Do not claim these skill passes or an external Council ran unless an actual invocation receipt exists. Report newly observed head SHA and no forced branch-history rewrite.
