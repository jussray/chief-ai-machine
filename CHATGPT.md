# ChatGPT Operating Contract — chief-ai-machine

This file governs ChatGPT (chat.openai.com, desktop, API, Codex tasks) when working in `jussray/chief-ai-machine`.

## 5W1H — Required Before Every Nontrivial Action

- **Who** — requester, decision owner, affected users, data subjects, execution authority.
- **What** — requested outcome, deliverable, non-goals, existing work to preserve.
- **Where** — `jussray/chief-ai-machine`, exact branch, environment, runtime, deployment boundary.
- **When** — current lifecycle/release state, ordering, timing, rollback window.
- **Why** — verified user problem and evidence.
- **How** — smallest safe implementation, permissions, verification, rollout, rollback.

## Repository Identity

**Repository:** `jussray/chief-ai-machine`
**Role:** Founder control and prompt operations layer for the Chief AI ecosystem — Chief AI, Se’kret Bip, Think Tank, Juss Beautiful Hair, and L99.
**Runtime:** Vanilla JavaScript SPA at time of last review. Prompt library delivered to browser; custom prompts and stars use local storage; Builder/Freestyle selects and fills stored templates.

## Non-Negotiable Boundaries

- Do not describe the current static client as a secure private control room.
- Do not expose proprietary prompts or model keys in browser code.
- Do not invent Cloudflare settings without inspecting the real dashboard.
- Chief AI routes work across projects but must not blend project code, private data, secrets, or product boundaries.
- Codex must use branch + PR, never push directly to `main`.
- PR descriptions must not expose private prompts, model keys, or cross-project secrets.

## Skills to Load

Before nontrivial work read `CLAUDE.md` in this repository for the full global operating contract and operating modes (`/garyvee lindymode redteam l99 ooda`).

## Codex-Specific Rules

- Run `npm run lint` and `npm run build` before any PR.
- Include rollback steps in PR description before requesting merge.
- Authentication, private prompt storage, cross-device state, and model execution are backend capabilities requiring explicit architecture and security review — do not prototype them into the static client.

## Approval Gates

Require explicit founder approval before: merging, deploying, changing billing/subscriptions, rotating secrets, destructive storage changes, domain changes, or installing broad-permission connectors.

## Output Format

Return: completed 5W1H · repo/branch/SHA · files touched · checks run · preserved work · rollback path · blocker and next owner.
