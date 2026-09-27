# Founder Work Productization Contract

Status: active constitutional workflow contract
Owner: founder
Applies to: Founder Control Room, Chief AI, PromptOS, project Control Rooms, ChatGPT/Codex, Claude/Claude Code/Cowork, Perplexity, Muse, Council members, Court participants, and repository-local skills unless a stricter local contract applies.

## Purpose

Chat is the invention lab. Founder Control Room is the durable workflow product layer.

A useful idea may begin in conversation, research, a Council round, a Court session, a repair, or a one-off founder task. Once the work becomes repeatable and proves a stable user outcome, it must stop depending on the founder remembering prompts, slash commands, old chats, provider quirks, or hidden model context. It should graduate into Founder Control Room as a governed reusable workflow that the founder or an authorized product user can run again.

The goal is not to move every conversation into software. The goal is to move repeated operational burden out of conversation so the founder can use future chats for new ideas, perspective, challenge, research, and decisions.

## Canonical productization loop

```text
IDEA / PROBLEM IN CHAT
→ recover the real user outcome
→ classify the owning OS, lane, project, and authority domain
→ challenge the premise and alternatives
→ prototype the smallest reversible path
→ prove the real path
→ decide ONE-OFF vs REPEATABLE
→ compile repeatable inputs, outputs, authority, tools, proof, rollback, privacy, cost, and stop gates
→ register the workflow in FCR
→ expose a user-facing workflow contract
→ run through FCR
→ capture receipts and outcomes
→ promote, revise, pause, or retire from evidence
→ free chat for the next idea
```

## No chat captivity

A graduated workflow must not require the founder to reconstruct the same internal command stack in a new conversation.

Manual commands such as `ULTRATHINK`, `/truthmode`, `/confess`, `redteam`, `lindymode`, `L99`, `OODA`, `/goalfix`, `attack N`, `/MAKEVIDEO`, `/LEEVIZE`, Council routing, Playwright proof, fingerprints, continuity cookies, or receipts remain valid expert controls and explicit overrides. They are not a tax the founder must repeatedly pay to receive behavior that already belongs to the workflow.

When a workflow is registered, the workflow owns its required internal composition. The user supplies the goal and required inputs. FCR routes the internal machinery.

## User-facing abstraction

Internal machinery is not the product surface.

Prefer user-facing outcome labels such as:

- `Repair my app`
- `Launch audit`
- `Decision challenge`
- `Turn this idea into a video`
- `Research and compare this decision`

Do not require ordinary users to understand the founder's internal command vocabulary, Council membership, model-provider names, proof-cookie format, repository layout, or orchestration implementation.

The internal stack remains inspectable in receipts for authorized operators, but users receive the governed outcome, evidence, unresolved risk, and next action.

## Responsibility split

### Founder Control Room

FCR owns the durable workflow product plane:

- workflow registry / library;
- user-facing workflow definitions and versions;
- tenant/user/project bindings;
- connected-tool and credential references;
- permissions and authority envelopes;
- guarded execution;
- durable state and workflow history;
- evidence, receipts, fingerprints, continuity, rollback, and supersession;
- current provider/runtime readback where required;
- outcome observations; and
- the public/product surface through which authorized users run workflows.

FCR does not need to expose the founder's private internal stack to product users.

### Chief AI

Chief owns intent compression and capability composition:

- recover the actual outcome from messy founder/user language;
- compare the new request with existing capabilities before inventing another system;
- select models, agents, skills, tools, Council seats, and evidence strategy;
- challenge assumptions and alternatives;
- detect repeated useful patterns;
- compile a repeatable pattern into an FCR `WorkflowCandidate` handoff;
- preserve lane-specific North Stars and success/failure signals; and
- recommend promotion, revision, or retirement from outcome evidence.

Chief is not the durable execution authority. A `WorkflowCandidate` is a proposal package, not permission to mutate external systems.

### PromptOS

PromptOS owns prompt/protocol/workflow compilation and lineage within its lanes:

- lane and intended workflow;
- lane-specific North Star;
- prompt/protocol lineage;
- execution/channel receipts;
- outcome attribution;
- successful reusable prompt assets; and
- revision memory for unsuccessful or unproven variants.

PromptOS may contribute compiled components to an FCR workflow. It does not create execution authority by promoting a prompt.

## WorkflowCandidate contract

Chief should emit a candidate only when productization is plausible. Minimum fields:

```text
workflow_id
name
public_label
user_outcome
source_goal
source_project
lane
north_star
internal_stack
inputs
outputs
authority_required
connected_tools
model_route
council_route
proof_required
required_proof_stage
rollback
privacy_class
cost_budget
success_signal
failure_signal
repeatability_evidence
graduation_status
```

Recommended status values:

`candidate | proving | approved_for_fcr | active | revise | paused | retired`

A candidate is not `approved_for_fcr` merely because multiple models agree.

## Graduation criteria

Graduate a workflow when enough of the following are true for the risk level:

1. The user outcome is stable and understandable.
2. The pattern is repeated, predictably reusable, or obviously recurring.
3. Inputs and outputs can be defined without hidden conversational state.
4. The owning OS/lane and authority boundaries are explicit.
5. Required tools and provider dependencies are known.
6. The real path has evidence, not only a plausible prompt or mock.
7. Success and failure signals are measurable.
8. Rollback or safe stop behavior is defined.
9. Privacy, tenancy, and cross-project boundaries are explicit.
10. Cost, latency, and provider failure behavior are acceptable.
11. Internal founder-only controls can remain hidden from ordinary users.
12. The workflow does not create duplicate authority or a parallel operating system.

Keep one-off tasks in chat or as bounded receipts. Do not productize novelty merely because it sounds reusable.

## Provider and key boundary

Model-provider credentials are intelligence access, not universal execution authority.

```text
OpenAI API key != GitHub authority
Anthropic API key != Supabase authority
Perplexity access != private runtime truth
Council consensus != founder approval
MCP tool availability != permission
```

OpenAI, Anthropic, Perplexity, Gemini, Muse, DeepSeek, local models, and future providers are replaceable capability providers behind the routing layer. External systems keep their own authenticated authorization and least-privilege boundaries.

A provider may reason about an action only with the evidence it is allowed to see. It may execute only through a separately authorized tool path.

## Agent roles

### ChatGPT / Codex

Use chat as a high-value invention, synthesis, debugging, implementation, challenge, and decision surface. When repeated operational work is proved, stop treating the conversation as the durable runtime and create or update the FCR workflow candidate instead.

### Claude / Claude Code / Cowork

Use Claude as an implementation/architecture operator when routed. Repository and provider state must return to the shared source of truth. A Claude workspace or conversation is not the durable workflow product plane.

### Perplexity

Use Perplexity for current public research, primary-source discovery, adversarial source validation, contradiction detection, and implementation-ready evidence handoff. Research may improve a workflow candidate but does not grant private runtime truth or execution authority.

### Muse and other Council members

Council members independently challenge, compare, implement when separately authorized, and preserve dissent. Council reasoning improves workflow design and proof quality. It does not become a separate workflow authority plane.

## Council productization rule

The Founder Council remains a backstage reasoning/review layer resident in the founder assistant host and project Control Rooms.

For user-facing FCR workflows:

- convene only the smallest relevant task-specific Council;
- expose the governed outcome rather than raw internal deliberation by default;
- label simulated seats as simulated and live provider seats only with real provider evidence;
- preserve meaningful dissent in operator receipts; and
- never convert Council agreement into execution authority.

When a Council pattern repeatedly produces a useful outcome, package the routing pattern into the FCR workflow rather than requiring the founder to manually reconvene the same seats in chat.

## Court productization rule

The StoryEngine Court remains a deliberation overlay across Writers Council, AI Council, and Production Council. It is not a fourth execution authority plane.

The Court keeps these invariants:

- route the smallest relevant jurisdiction set;
- independent-first findings before reconciliation;
- `/DEVIL` cross-examination;
- creator/founder ruling;
- tool capability does not equal permission; and
- the councils expand possibility; the creator makes the ruling.

A repeated Court pattern may become an FCR/StoryEngine workflow with a stable public label, inputs, output packet, proof, canon boundary, creator override, and rollback. Productization never removes the creator ruling.

## Instruction inheritance

This contract is shared doctrine. Root `AGENTS.md`, provider operating contracts, Council/Court documents, and constitutional skills should either reference this contract directly or inherit it through a repository parent contract.

Leaf `SKILL.md` files do not need copied prose. They inherit this contract unless a stricter local rule applies. A leaf skill may specialize the workflow but may not:

- make chat the permanent state store for repeatable operations;
- bypass FCR workflow authority;
- expose founder-only internal machinery as a user requirement;
- turn a model/provider key into unrelated service authority;
- convert Council/Court consensus into approval; or
- create a competing execution/control plane.

Repository verification should fail when first-class agent/provider/Council/Chief instructions materially contradict these invariants.

## Task clearance invariant

A task does not clear because work started, code changed, a PR opened, CI ran, models agreed, or an agent said `done`.

A task clears only when the proof required by the original goal is satisfied by current evidence.

Use this task lifecycle:

`OPEN | ACTIVE | BLOCKED | PROOF_PENDING | PROVEN | CLEARED`

`PROVEN` is an evidence predicate. `CLEARED` is the task-state transition permitted only when that predicate is true for the task's declared `required_proof_stage` and acceptance criteria.

At task creation or first serious execution, bind:

```text
task_id
original_goal
owning_system
acceptance_criteria
required_proof_stage
required_evidence
current_proof_stage
status
blockers
remaining_gate
proof_subject / exact version when applicable
cleared_by_evidence
cleared_at
supersedes / superseded_by
```

Proof-stage matching is goal-sensitive:

- a task whose goal is source authoring may clear at `SOURCE IMPLEMENTED` when its acceptance criteria and exact-source checks pass;
- a task whose goal includes merge stays open until `MERGED` is proven;
- a task whose goal includes deployment stays open until `DEPLOYED` is proven;
- a task whose goal says fix the live/runtime path stays open until `RUNTIME VERIFIED` is proven;
- a task whose goal is a real user/business outcome stays open until `OUTCOME VERIFIED` is proven;
- research/current-fact tasks use their own evidence/freshness contract rather than pretending a software proof stage applies.

Earlier stages never silently satisfy a later-stage goal. `SOURCE IMPLEMENTED` is not `MERGED`; `MERGED` is not `DEPLOYED`; `DEPLOYED` is not `RUNTIME VERIFIED`; `RUNTIME VERIFIED` is not automatically `OUTCOME VERIFIED`.

When some work succeeds but the required proof is incomplete, report the achieved stage and leave the task `PROOF_PENDING` or `BLOCKED` with the exact `remaining_gate`. Do not mark it complete, close it, archive it, remove it from the active ledger, or tell the user it cleared.

Exact-head/version movement invalidates proof that was bound to the predecessor where that evidence no longer applies. The task returns to `PROOF_PENDING` until the successor state is re-proven. Preserve predecessor evidence as history rather than deleting it.

A previously cleared task may be reopened when new authoritative evidence proves that its clearance predicate no longer holds and the task contract is still meant to guarantee the condition. Record the invalidating evidence and successor task state.

For assistant behavior, words such as `done`, `complete`, `fixed`, `cleared`, `live`, or `working` are proof claims and must obey this rule.

## Proof vocabulary

Keep ontology and proof state separate.

For a workflow, report independently where applicable:

`DECLARED | SOURCE IMPLEMENTED | MERGED | DEPLOYED | RUNTIME VERIFIED | OUTCOME VERIFIED`

A workflow can remain a workflow when blocked or unverified. Lack of runtime proof does not silently demote its identity.

## Launch priority

Before adding another conceptual subsystem, ask whether an existing proven chat pattern can be turned into a runnable FCR workflow that reduces founder repetition and produces user value.

The launch metric is not number of smart chats, prompts, Council rounds, or architectural documents. The stronger evidence is that a founder or authorized user can run a useful workflow through FCR, receive a truthful result and receipt, and do it again without rebuilding the system in conversation.
