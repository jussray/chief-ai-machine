---
name: evidence-decision-loop
description: Turn mixed source, execution, and outcome evidence into a bounded decision without confusing activity, provider acceptance, vanity signals, stale proof, or disagreement with goal success or error. Use for experiment conclusions, release/merge review, performance calls, and any recommendation that depends on multiple evidence planes.
---

# Evidence Decision Loop v1

Use the existing Chief work loop as the carrier:

1. **Observe** the exact subject and current fingerprint.
2. **Orient** around the human goal, primary success signal, authority ceiling, proof planes, and material disagreement.
3. **Redteam** stale proof, selection bias, vanity metrics, provider-only acceptance, missing witnesses, hidden assumptions, and rollback gaps.
4. **Decide** the smallest next gate. A secondary signal cannot declare the primary goal successful, and a different answer is not automatically an error.
5. **Act** only within separately granted authority. Analysis never grants merge, deploy, publish, send, spend, delete, or production authority.
6. **Verify** execution and outcome separately. Execution proof can advance the workflow but cannot prove user/business outcome.
7. **Report** Reality, Bound, Decision, Proof, Risk, Rollback, and Next Gate.

## Truth contract

Classify claims as `VERIFIED`, `OBSERVED`, `INFERRED`, `UNKNOWN`, or `BLOCKED` and bind evidence to `source`, `execution`, or `outcome`.

A changed branch head, runtime identity, proposal fingerprint, experiment subject, or other bound fingerprint invalidates predecessor proof for the changed subject. Historical receipts remain historical evidence but do not become fresh proof.

Founder-confirmed execution is legitimate source/observation evidence. It is not independent platform or outcome verification unless an independent witness is also present.

## Divergence review

When a candidate answer, interpretation, model output, review conclusion, or operator judgment differs from the expected answer, do not classify it as wrong merely because it differs.

Reconstruct the path first:

1. state the exact point of divergence;
2. list the assumptions that would make the candidate path coherent;
3. identify the hidden variable, alternate definition, scope, timing, authority source, or evidence interpretation that could explain the difference;
4. name a falsifier: what observation would prove that path cannot be true;
5. test the competing paths against the strongest applicable evidence and authority;
6. preserve `unresolved` when evidence does not settle the disagreement.

A reconstructable alternate path is a **hypothesis to test**, not a truth upgrade. It becomes `RESOLVED` only when verified evidence supports a named resolution such as `expected`, `candidate`, `both-contextual`, or `neither`.

Hard boundaries do not become debatable assumptions. Safety, privacy, authorization, repository/provider authority, exact-subject binding, and explicit founder gates cannot be reasoned around to make an answer work. Any alternate path that depends on crossing those boundaries is `REJECTED_BOUNDARY`.

## Decision rules

- Execution green + outcome unknown => **MEASURE**, not success.
- Secondary/vanity signal green + primary signal unknown => **MEASURE**, not winner.
- Verified outcome + primary signal improved => **PROPOSE KEEP**, never self-authorize.
- Verified outcome + primary signal degraded => **PROPOSE TUNE/STOP** according to the product-specific adapter.
- Stale or fingerprint-mismatched proof => **REOBSERVE**.
- Missing authority => **HOLD/REVIEW** even when evidence is green.
- Divergent answer + reconstructable assumptions + falsifier + unresolved evidence => **INVESTIGATE DIVERGENCE**.
- Divergent answer that requires a safety/authority bypass => **REJECT BOUNDARY**, not investigation.

## Merge readiness adapter

For merge review, bind every conclusion to the **current PR head**, the **reviewed head**, the active repository rules, and the exact-head check runs.

Apply these gates in order:

1. **Head freshness.** If the PR head differs from the reviewed/proved head, return `REOBSERVE`. Earlier checks, approvals, founder merge authority, and review conclusions become historical for the moved head.
2. **Required check materialization.** Enumerate every status context required by active repository rules. A context that is merely “expected,” missing, queued forever, or attached to another SHA is not green proof. Hold at `WAIT_REQUIRED_CHECKS` until each required context completes successfully on the current head.
3. **Code scanning.** Treat CodeQL/code-scanning policy as a separate gate from ordinary status checks. Required checks green + scanning unknown is `WAIT_CODE_SCANNING`, not merge-ready.
4. **Independent last-push approval.** When repository rules require approval from someone other than the last pusher, the reviewer identity must differ from the last pusher and the review must actually be `APPROVED`. A quota-limited bot, self-review, comment-only review, missing reviewer, or unavailable reviewer remains `WAIT_INDEPENDENT_APPROVAL`.
5. **Founder merge authority.** Explicit founder authority is required at the current head. Authority granted for a predecessor head does not roll forward after head movement.
6. **Merge method.** If linear history is required, do not retry a merge commit after GitHub rejects it. Prefer `squash` when allowed, otherwise `rebase`. Never weaken the linear-history rule merely to make the merge succeed.
7. **Execute only after READY.** Even when the evaluator returns `READY`, it is still bounded decision support. Do not fabricate approval, bypass a ruleset, disable CodeQL, remove required contexts, or relax branch protection to manufacture a merge.

The executable merge adapter must preserve these invariants:

- required checks must materialize on the reviewed head;
- code scanning is separate merge evidence;
- independent approval cannot be self-satisfied;
- linear history forbids merge-commit fallback;
- head movement expires review proof and merge authority;
- a repository bypass capability is not itself permission to bypass.
