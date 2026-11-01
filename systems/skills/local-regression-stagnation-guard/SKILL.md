

# Regression & Stagnation Guard

## When to Use This Skill

Use when:
- Before committing or deploying any code change
- A project feels stuck — you're making changes but not progress
- You've tried the same fix more than twice
- Dependencies might have drifted or broken
- You need to verify existing functionality still works after a change
- After returning to a project after time away

## Regression Checklist (Run Before Every Commit)

Before marking any increment as done, verify:

### 1. Before/After State
- What worked before this change? List it.
- Does it still work after this change? Test each item.
- What new behavior was added? Does it work? Test it.

### 2. Acceptance Criteria
- Was there a specific outcome defined for this change?
- Is that outcome achieved and verifiable?
- If not testable, what manual step confirms it works?

### 3. Side Effects
- Did this change touch any shared/utilities files?
- Could this break imports in other files?
- Are there environment variables or config that changed?
- Did any package versions change?

### 4. Dependency Integrity
- Run: `npm ls` / `pip list` / `gem list` (or equivalent) — any errors?
- Are lockfiles unchanged if dependencies weren't intentionally updated?
- Are there peer dependency warnings that weren't there before?

### 5. Quick Smoke Test
- Does the app/script start without errors?
- Does the primary user flow still complete?
- Are there console errors that weren't there before?

## Stagnation Detection

### Stuck-Loop Detector

Watch for these patterns and intervene:

| Pattern | Signal | Action |
|---------|--------|--------|
| Same error 2+ times | You're fixing symptoms, not cause | Stop. Re-read the error. Search for root cause. |
| Rewriting same code 3+ times | Design is wrong | Step back. Draw the data flow. Start fresh. |
| No commits in 30+ min of work | Gold-plating or stuck | Commit what works. Move on. |
| Cycling between approaches | Decision paralysis | Pick the simplest. Ship it. Improve later. |
| Adding more code to fix bugs | Complexity spiral | Delete code. Simplify. Re-test. |

### Stagnation Recovery Protocol

When stagnation is detected:

1. **Stop coding.** Write what you know and what you don't know.
2. **State the actual problem** in one sentence. Not the symptom. The problem.
3. **Identify the smallest possible next step** that produces a testable result.
4. **If you can't find it:** the problem is too big. Break it down further.
5. **If you can't break it down:** you lack information. Research first (truth-research-optimizer).
6. **If research doesn't help:** ask the user. A 30-second human answer beats 2 hours of guessing.

### Returning to a Stalled Project

When picking up a project that's been idle:

1. Read the TODO ledger (see lean-build-orchestrator)
2. Check git log for last committed state: `git log --oneline -10`
3. Run existing tests: are they all passing?
4. Identify what was in progress when you stopped
5. Identify what blocked you (if anything)
6. Decide: continue current path, or pivot to a different increment
7. Write the decision and reasoning to the TODO ledger

## Anti-Regression Patterns

### The "Working State" Rule
- Always know what the last known working state was
- Commit after every successful test with a descriptive message
- If a change breaks something, `git diff` to see exactly what changed
- Never leave a broken state — if you can't fix it, revert and try a different approach

### The "One Change" Rule
- Make one change at a time
- Test after each change
- If you need to change 3 files for one feature, do it in sequence, testing between each

### The "Delete First" Rule
- Before adding new code to fix a bug, check if deleting code fixes it
- Simpler > complex. Fewer lines > more lines. No code > some code.
- If a feature isn't being used, remove it. Dead code causes regressions.

## Integration

- Works with **lean-build-orchestrator** as the safety layer after each increment
- Uses **capability-mode-router** `/redteam` mode to adversarially test changes
- Uses **truth-research-optimizer** when stuck on a technical question
## Available connectors

Use `muse.connector_search` to find the current connector docs before following
recovered instructions.
