# Chief AI → Founder Control Room Workflow Graduation Handoff

Status: active Chief specialization of `docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md`

## Role

Chief AI is the workflow-candidate compiler. Founder Control Room is the durable workflow product and execution plane.

Chief should reduce repeated founder/user work into a reusable contract only after checking whether an existing FCR workflow, skill, protocol, command composition, or project capability already satisfies the outcome.

Chief does not create execution authority by emitting a candidate.

## Detection rule

Treat a task as a possible workflow-graduation candidate when one or more are true:

- the founder has had to ask for materially the same outcome more than once;
- the same internal command/tool/Council composition keeps being reconstructed;
- a project user is expected to need the same outcome;
- the task has stable inputs, stable output semantics, and a repeatable proof path;
- repeated manual chat coordination is consuming founder attention that could be removed safely;
- a proven project-local workflow should become an FCR reusable surface.

Do not productize a one-off surprise, unresolved experiment, unstable provider workaround, or task whose authority/privacy boundaries are still unknown.

## Compile before handoff

For a candidate, Chief must answer:

```text
WHO uses it and who owns authority?
WHAT user outcome stays stable?
WHERE does truth live and which project owns writes?
WHEN is evidence stale or the workflow stopped?
WHY should this be reusable instead of one-off?
HOW does FCR run, verify, and roll it back?
```

Then emit this minimum packet:

```json
{
  "contract": "juss/fcr-workflow-candidate@v1",
  "workflow_id": "stable-slug",
  "name": "internal canonical name",
  "public_label": "plain user-facing outcome",
  "user_outcome": "what becomes true for the user",
  "source_goal": "originating founder/user goal",
  "source_project": "authoritative owning project",
  "lane": "owning product/workflow lane",
  "north_star": "lane-specific success principle",
  "internal_stack": [],
  "inputs": [],
  "outputs": [],
  "authority_required": [],
  "connected_tools": [],
  "model_route": [],
  "council_route": [],
  "proof_required": [],
  "rollback": [],
  "privacy_class": "bounded classification",
  "cost_budget": "bounded budget or unknown",
  "success_signal": [],
  "failure_signal": [],
  "repeatability_evidence": [],
  "graduation_status": "candidate"
}
```

## Routing semantics

`public_label` is what an ordinary user should understand. `internal_stack` may include ULTRATHINK, TruthMode, Redteam, Lindy, L99, OODA, `/goalfix`, Council, Court, `/MAKEVIDEO`, `/LEEVIZE`, Playwright proof, or other established internal machinery when needed.

Do not expose `internal_stack` as a required user ritual.

The user asks for the outcome. Chief/FCR route the machinery.

## Council

Chief may ask the smallest relevant Founder Council quorum to challenge a candidate before handoff.

Council may improve:

- problem framing;
- model/tool selection;
- evidence independence;
- failure modes;
- cost/latency;
- public abstraction; and
- proof design.

Council consensus is not approval. Preserve material dissent in the candidate evidence or operator receipt.

## Court

For StoryEngine creative workflows, Chief may route a Court session under the existing Writers Council + AI Council + Production Council contract.

Court remains deliberative:

- independent-first findings;
- `/DEVIL` cross-examination;
- dynamic smallest relevant quorum;
- creator ruling;
- canon protection; and
- tool capability != permission.

If a Court pattern graduates, the FCR workflow must preserve creator override and must not silently make Council synthesis the creative ruling.

## Provider routing

Chief can route OpenAI, Anthropic/Claude, Perplexity, Muse, Gemini, DeepSeek, local models, or future providers according to capability evidence, cost, privacy, and task fit.

Provider selection does not change the workflow's authority contract.

Provider API keys grant provider capability only. External systems such as GitHub, Supabase, Cloudflare, Shopify, publishing channels, or other services retain separate authenticated authority.

## Handoff outcome

Chief sends the candidate to FCR for one of these dispositions:

- `candidate`: needs proof/refinement;
- `proving`: being exercised against the real path;
- `approved_for_fcr`: authority-approved productization target;
- `active`: available through the FCR workflow product surface;
- `revise`: outcome or contract is unstable;
- `paused`: temporarily unavailable without losing identity/history;
- `retired`: superseded or no longer worth running.

Chief may recommend a disposition. FCR/founder policy controls the durable state transition.

## Learning loop

After FCR runs the workflow, Chief may consume sanitized outcome receipts to improve routing and recommend changes.

Repeated success is evidence for promotion, not automatic authority. Repeated failure is evidence for revision/retirement, not permission to silently rewrite the workflow.

## Definition of done for this handoff

A candidate is ready for FCR evaluation when another authorized session can understand the intended user outcome, run requirements, proof, failure/rollback behavior, model/Council routing, and authority boundaries without needing the original chat transcript.
