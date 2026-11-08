# Continuity Fingerprint Protocol

Purpose: make future founder shorthand resolvable without guessing, while preserving repository truth as authority.

## Resolution rule

Use shorthand as a retrieval signal, never as proof.

```text
founder shorthand
→ conversation/history fingerprints
→ candidate project
→ authoritative repository verification
→ action
```

For Chief AI Machine, high-signal fingerprints include: prompt operating system, capability router, prompt library, specialist agents, founder content learning, merge-intent evaluation, private model/backend boundary, Chief AI, and cross-project AI orchestration.

If a fingerprint could belong to PromptOS, FCR, or another project, verify the exact repo, branch, files, PR/issue, and current `main` before acting.

## Genesis fingerprint

When asked when this project started, resolve in this order:
1. GitHub repository `created_at`.
2. Root/first commit reachable from authoritative history.
3. Earliest substantive implementation commit.
4. Historical docs that reference earlier work.
5. Earliest available conversation about the project.
6. Earlier uploaded designs, files, or artifacts.
7. Founder testimony, labeled as founder-reported rather than GitHub proof.

Keep idea genesis, repo genesis, first recorded build, first substantive build, launch milestones, and current state separate.

## Truth states

Always distinguish VERIFIED, INFERRED, REMEMBERED, UNKNOWN, STALE, and BLOCKED.

## Supersession and decay

Prior plans, prompts, branches, screenshots, PR descriptions, or deploy claims lose authority when `main`, runtime, provider state, or governing contracts change. Revalidate before reuse.

## Reuse rule

Every correction should leave a reusable fingerprint. Prefer exact prompt IDs, functions, routes, failing tests, PRs, SHAs, provider boundaries, and prior decisions before broad repo scans.

This protocol supplements `AGENTS.md`, `CLAUDE.md`, Founder Intelligence, release truth, privacy/security, and approval gates. It never overrides a stricter rule or grants mutation authority by itself.
