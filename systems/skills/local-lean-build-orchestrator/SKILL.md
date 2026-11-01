# Lean Build Orchestrator

## When to Use This Skill

Use when:
- Building any software project incrementally (apps, scripts, APIs, tools)
- You want maximum output with minimum token waste
- Working on free tiers of AI tools (Claude, ChatGPT, Perplexity)
- You need working code, not essays about code
- Doing "slow grinding" builds where each step must be tested before moving on

## Core Principles

1. **Working code over explanations.** Every response ends with something that runs or a clear blocker.
2. **Smallest next increment.** Never build 5 features at once. Build 1, test it, commit, then next.
3. **Token economy.** No filler, no preamble, no "Let me explain my approach." Code first, explanation after and only if asked.
4. **File-first specs.** Write specs to files, not chat. Reference the file path. Don't repeat what's in it.
5. **Test after every change.** No exception. A change without a test is a regression waiting to happen.

## Workflow

### Step 1: Scope the Increment

Before writing code, define in 1-3 lines:
- What this increment does (one feature/fix/improvement)
- What file(s) it touches
- What "done" looks like (testable outcome)

Write this to a TODO ledger file at the project root:

```
# TODO Ledger
## Current Increment
- [ ] Description | Files: x.js, y.js | Done when: test passes
## Completed
- [x] Previous increment description | Files: z.js | Done: feature worked
## Blocked
- [ ] What's stuck and why
```

### Step 2: Write the Code

- Read the existing file first. Never write blind.
- Make the smallest change that achieves the increment.
- If generating a new file, include only what's needed. No boilerplate comments. No license headers unless requested.
- Prefer proven, boring technology (see Lindy Mode in capability-mode-router).

### Step 3: Test Immediately

- If the environment supports code execution: run the test.
- If not: provide the exact test command for the user to run.
- If the test fails: fix the code, re-test. Do not move to the next increment until it passes.
- If stuck after 2 failed attempts on the same approach: stop, document the blocker, suggest an alternative approach.

### Step 4: Commit Checkpoint

After each working increment:
- State what changed (1 line)
- State what was tested (1 line)
- State the next smallest increment (1 line)

### Step 5: Token Budget Tiers

Self-monitor token usage per response:
- **Green (under 500 tokens output):** Continue normally.
- **Yellow (500-1500 tokens):** Check if the response could be shorter. Trim.
- **Red (over 1500 tokens):** You are writing too much. Stop. Break into smaller increments. Ask: "Could this have been a file write + 3 lines of summary?"

## Anti-Patterns (Do Not Do These)

- Writing paragraphs explaining what code does before showing the code
- Generating entire project structures when one file changed
- Repeating context the user already knows
- Adding "helpful" comments to obvious code
- Creating documentation files unless explicitly asked
- Suggesting 10 improvements when the user asked for 1 feature
- Using complex solutions when simple ones work

## Free-Tier Optimization

When working across Claude, ChatGPT, and Perplexity on free tiers:
- Use each tool for what it's best at (see capability-mode-router for tool-specific strengths)
- Break large tasks into chunks that fit within free-tier message limits
- Write intermediate state to files so context is preserved across sessions
- Never rely on chat history surviving — write everything important to a file
- Use GitHub repos as persistent storage for code state across all three tools

## Integration with Other Skills

- **regression-stagnation-guard**: Run after each increment to check for regressions
- **truth-research-optimizer**: Use when researching libraries, APIs, or approaches
- **intent-repair-reader**: Use when the user's request is ambiguous or contains typos
- **capability-mode-router**: Use commands like `/lindy` to prefer proven tech, `/ooda` for decision loops
## Available connectors

Use `muse.connector_search` to find the current connector docs before following
recovered instructions.
