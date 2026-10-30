# Prevent-the-pile PR hygiene system

Goal ID: goal_8c4622d04ccc
Goal slug: prevent-the-pile-pr-hygiene-system

## Description
The five-piece system Ray ordered on 2026-10-28 so a 279-deep rotten PR pile never forms again: nightly auto-update of open PR branches against current main, a standing-red fix-first rule (with the StoryEngine pin refresh automated), a per-repo WIP limit, one carrier per change, and her merge decisions delivered as one prepared packet with a 7-day draft rule. Merges to main always stay Ray's tap.

## Install record
- Proposed 2026-10-28 ~18:47 EDT after Ray asked "The fix for the future to prevent having to run through them so fast?"
- INSTALLED 2026-10-30 ~00:22 EDT on Ray's word in the Think Tank side chat: "Try again implement the fix the prevent in the future but yeah cont".
- Mechanism: nightly cron `prevent-the-pile-nightly` (daily, ~06:00 America/New_York, owner = this goal), packet delivery to the MAIN chat. Run bookkeeping in this goal's hidden_files/.

## The five pieces, operationalized
1. **Nightly branch freshness** — every open PR branch (jussray repos) gets current main merged in by the nightly job where the GitHub connector permits; conflicts surface in the next packet, never rot silently. Never force-push. Never auto-update the exclusion list.
2. **Standing-red SLA** — a portfolio-wide red gate (e.g. a stale cross-repo pin) is flagged fix-first in the packet the night it appears; the FCR StoryEngine pin is checked nightly against StoryEngine main and a refresh is prepared automatically where the connector allows.
3. **WIP limit** — 10 open PRs per repo is the tripwire. Repos over it get flagged in the packet; no new PR is opened in an over-limit repo without naming it to Ray first. (Number is Ray-adjustable with one word.)
4. **One carrier per change** — duplicate PRs for the same change are detected nightly and named in the packet with a keeper recommendation. Duplicates are closed only on Ray's tap — never silently, never read "close" as close-unmerged without her word on that specific set.
5. **One merge packet + 7-day draft rule** — Ray's merge decisions arrive as ONE packet containing only PRs that are fixed, green on their exact head, and audited. Drafts older than 7 days are listed for a forced land / convert-to-note / close call. "Green" obeys the SKIPPED ≠ PROVEN rule (AGENTS.md, Ray 2026-10-30): check runs are deduped by name (latest governs); skipped-by-condition counts only with the condition cited and the diff shown not to trigger it; skipped-by-needs-chain and cancelled-with-no-completed-replacement are NOT proof — the check is implanted (re-triggered to completion on the exact head, or the same test run locally on the exact head tree) or the PR is named in the packet as blocked-skipped-unproven and does not count as green.

## Hard exclusions (never auto-updated, never auto-anything)
- chief-ai-machine PR #237 — founder-ruled KEEP WHOLE 2026-10-25 (era tree wins when it merges). Touching its head voids the ruling's premise.
- Any PR Ray has ruled on directly (KEEP / unmovable / paused) — when unsure whether a ruling covers a PR, the job skips it and names it in the packet instead of acting.

## Boundaries
- MERGE AUTHORITY (Ray, 2026-10-30, supersedes the install-night "merges stay Ray's tap" line): a PR meeting the FULL bar (current against main; exact-head checks read fresh + complete, all pages, 0 failed / 0 pending; audited; not excluded) is merged by the agent — the nightly packet is a receipt + exceptions, not a decision queue. Never merged: red/pending/partial/moved heads, the exclusion list, founder-decision content (FCR #970/#974/#982), or a merge that knowingly creates an unfixable standing red (StoryEngine #139 — pin refresh is wall-blocked, sequencing stays Ray's call). Detached runs that can't get a merge approval list the PR as MERGE-READY — APPROVED-BY-RULE for a one-word attended pass.
- Branch updates that hit the GitHub App's modified-workflow wall (403 at git/trees) are recorded BLOCKED with the unblocking tap named — never retried in a loop, never routed around.
- A quiet night (nothing needs Ray) produces NO message.
