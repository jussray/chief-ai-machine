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

The gate reopens the issue when evidence is absent, stale, edited after closure, malformed, not founder-authored, or still reports unresolved risk. Prompt creation, provider output, automation, publishing, or verbal approval do not automatically authorize closure.
