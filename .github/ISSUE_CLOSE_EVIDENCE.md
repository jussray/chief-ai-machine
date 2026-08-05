# Issue Closure Evidence Template

Post this as a new issue comment immediately before closing an issue. If the issue was reopened, create a new comment for the current close cycle. Do not reuse old evidence or edit it after clicking close.

```md
## Closure Evidence
Resolution: <what was actually resolved>
Scope: <code | docs | operations | non-code>
Exact head: <40-character commit SHA | not_applicable: specific reason>
Proof: <tests, provider checks, rendered proof, or authoritative evidence>
Rollback: <how to reverse the change or reopen the work>
Next gate: <next required action | none>
Unresolved risks: none
Founder approval: @jussray
```

For code or documentation scope, `Exact head` must be the current default-branch head. An old ancestor, unmerged branch commit, fabricated SHA, abbreviation, branch name, PR number, or `not_applicable` fails. A later evidence-shaped comment from another author does not replace fresh founder evidence, and a stale workflow rerun does not mutate a newer close cycle.

The gate reopens the issue when evidence is absent, stale, edited after closure, malformed, not founder-authored, or still reports unresolved risk. A passing gate posts one idempotent receipt with the evidence comment ID, timestamps, and SHA-256 witness without copying raw evidence. Prompt creation, provider output, automation, publishing, or verbal approval do not automatically authorize closure.
