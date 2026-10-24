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
