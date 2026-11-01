

# Truth Research Optimizer

## When to Use This Skill

Use when:
- Researching technical approaches, libraries, or frameworks
- Verifying factual claims or API documentation
- Comparing options before choosing a technology
- Synthesizing information from multiple sources
- You need to cite sources accurately
- Preventing hallucinated API methods or outdated syntax

## Source Hierarchy (Use in Order)

1. **Official documentation** — API docs, README, official guides
2. **Source code / type definitions** — TypeScript .d.ts files, Python stubs, Go interfaces
3. **Recent test files** — Show actual usage patterns
4. **GitHub issues and PRs** — For edge cases, known bugs, breaking changes
5. **Stack Overflow / community forums** — For common problems, but verify against #1
6. **Blog posts and tutorials** — Last resort. Always verify against official docs.
7. **Training data / memory** — Never trust alone. Always verify with a live source.

## Research Protocol

### Step 1: Define What You Need to Know

Write a single question:
- "Does library X support feature Y in version Z?"
- "What's the correct syntax for X in the current version?"
- "Is approach A or B better for use case C?"

### Step 2: Search with Precision

- Search for the specific version number, not just the library name
- Include the year or "2025" / "2026" to get recent results
- Search official docs first: `site:docs.example.com feature name`
- Search GitHub: `repo:owner/name feature or API`

### Step 3: Cross-Verify

For any claim that affects code:
- Find it in at least 2 independent sources
- Check the source date — is it from the current major version?
- If sources conflict, prefer official docs and source code

### Step 4: Confidence Labeling

After gathering information, label each finding:

- **[VERIFIED]** — Found in official docs or source code, current version
- **[LIKELY]** — Found in multiple recent community sources, consistent with docs
- **[UNCERTAIN]** — Only one source, or sources conflict, or information is old
- **[UNVERIFIED]** — From training data only, not confirmed by live source

Never write code based on [UNVERIFIED] information without a fallback.

### Step 5: Contradiction Resolution

When sources conflict:

1. Note the contradiction explicitly: "Source A says X, Source B says Y"
2. Check the dates — which is more recent?
3. Check the versions — which matches the target version?
4. Check the authority — official docs > community posts
5. If still unclear: test it. Write a minimal reproduction and run it.
6. If you can't test: state both options and ask the user.

### Step 6: Synthesis

When combining information from multiple sources:

- Lead with the most authoritative finding
- Note where sources agree (strong signal)
- Note where sources disagree (weak signal — needs resolution)
- Never present a synthesized claim as if it came from one source
- Cite the actual source for each claim

## Anti-Hallucination Rules

1. **Never invent API methods, function signatures, or property names.** If you're not sure, look it up or say you're not sure.
2. **Never guess version-specific behavior.** Libraries change. What worked in v3 may not work in v4.
3. **Never fabricate URLs or citations.** If you don't have a source, say so.
4. **Never present training-data knowledge as verified fact.** Label it [UNVERIFIED] and verify.
5. **When you find you were wrong, correct immediately.** State what was wrong, what's right, and why.

## Research Output Format

When research is complete, produce:

```
## Research: [Question]
### Answer
[Direct answer in 1-3 sentences]

### Evidence
1. [VERIFIED] — [claim] ([Source Name](URL))
2. [LIKELY] — [claim] ([Source Name](URL))
3. [UNCERTAIN] — [claim] (note what's uncertain)

### Conflicts
- [If any conflicts were found and how they were resolved]

### Recommendation
[What to do based on this research, in 1-2 lines]
```

## Integration

- Use **lean-build-orchestrator** to turn research findings into working code
- Use **capability-mode-router** `/redteam` mode to adversarially test research conclusions
- Use **intent-repair-reader** when research queries are ambiguous
## Available connectors

Use `muse.connector_search` to find the current connector docs before following
recovered instructions.
