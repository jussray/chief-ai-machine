---
schema: juss/chatgpt-sites-repository-binding@v1
project_id: chief-ai-machine
canonical_repository: jussray/chief-ai-machine
canonical_branch: main
authority_repository: jussray/founder-control-room
site_identity_status: verified
site_origin: https://chief.p9s5nbwqyt.chatgpt.site
account_owner: unverified
chatgpt_site_url: https://chief.p9s5nbwqyt.chatgpt.site
custom_domain: null
control_room_link: null
last_verified: "2026-09-06"
verification_source: "founder-provided ChatGPT Sites runtime URL; live control-room handoff/readback pending"
continuity_status: UNKNOWN
---

# ChatGPT Sites repository binding — Chief AI Machine

This file defines the repository-side contract for a ChatGPT `@Sites` surface representing Chief AI Machine. It does not create a Site, prove a Site is connected, or prove publication.

## Cross-account continuity

The frontmatter is the repository-side continuity record for this Site. `account_owner` identifies only a verified editor-account binding and must not expose private account-holder identity. `chatgpt_site_url`, `custom_domain`, `control_room_link`, `last_verified`, and `verification_source` must come from the authority that can actually observe them. `continuity_status` is one of `VERIFIED`, `UNKNOWN`, `STALE`, or `SUPERSEDED`.

Unknown stays unknown. Chat memory, another phone/account, a naming convention, DNS intent, or a repository guess must never upgrade an unverified field. The Site editor/account is authoritative for Site identity/publication, the canonical repository for project/source truth, Cloudflare for DNS/deployment truth, and Founder Control Room for cross-project authority/evidence registry truth.

## Canonical source

The Site must treat `jussray/chief-ai-machine` as the only canonical Chief AI repository and resolve the current `main` head at use time. Current repository/provider/runtime evidence outranks Site snapshots, old PRs, generated summaries, and chat memory.

Before material planning, editing, publication, deployment, cross-repository coordination, or a current-state claim, read and apply the current versions of:

- `AGENTS.md`
- `AGENTS_FOUNDER_INTELLIGENCE.md`
- `CHATGPT.md`
- `CLAUDE.md`
- `docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md`
- `docs/PUBLIC_COMMUNICATION_TRUTH_CONTRACT.md`
- `config/founder-chief-pair.contract.json`
- `.control-room/repository.manifest.json`

Stricter repository-local rules always win.

## Read contract

A Site may render public-safe Chief AI state only from the canonical repository and current evidence. It must distinguish recommendation from authority, source from runtime, execution from outcome, and current from historical/stale/superseded/unknown evidence.

Never expose raw prompts, saved drafts, clipboard content, provider responses, API keys, private user identity, raw private logs, proprietary routing mechanics, or other Sauce Guard material in a public Site.

## Write contract

A Site may prepare Chief AI changes only through a focused branch and pull request created from freshly resolved `main`.

It must not push ordinary implementation directly to `main`, force-push, delete founder material, bypass required checks, or let model output grant itself execution authority. Every write must preserve exact repository/base/head identity, changed paths, verification state, rollback, and next gate.

A repository write or merge never silently authorizes deployment, publication, credentials, DNS, billing, provider mutation, or external communication.

## Publication contract

Chief AI is the cognition, synthesis, capability-composition, recommendation, and public-story proposal layer. Founder Control Room remains the governed execution and publication authority for portfolio actions.

The exact ChatGPT Site runtime URL `https://chief.p9s5nbwqyt.chatgpt.site` is now recorded from founder-provided Site runtime evidence. Its editor-account binding, custom domain, control-room handoff, and current live publication state remain unverified in repository evidence, so the continuity record remains `UNKNOWN` rather than inferring them.

Publication must bind to the intended exact repository state, re-read this authority chain, apply Sauce Guard, preserve the Founder Control Room/Chief pair boundary, and capture an observable Site artifact. A draft, save, commit, PR, merge, workflow trigger, or deployment on another provider is not ChatGPT Sites publication proof.

## Pair-drift rule

A material Site contract or founder-facing behavior change in Chief AI must be reviewed against Founder Control Room. If the two sides no longer agree on roles, authority, evidence, or publication semantics, report `pair drift` and make synchronization the next gate rather than silently continuing.

## Stop conditions

Stop on stale head, unreadable authority files, pair drift, private/proprietary-content risk, an unverified continuity field needed for the requested action, or a separately gated deployment/publication/provider action without current authority.
