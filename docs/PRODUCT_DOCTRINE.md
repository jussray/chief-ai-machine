# Chief AI Standalone Product Doctrine

## Category

Chief AI is a **Founder Intelligence OS**.

It converts founder judgment, company context, reusable prompts, decisions, workflows, research, benchmarks, brand voice, and operating playbooks into portable company-owned intelligence.

It is not defined by the current repository name, a specific AI provider, a Git host, or Jussray's current portfolio.

## Customer problem

Founders and small teams repeatedly lose valuable context inside disconnected AI chats, documents, tools, providers, and projects. They restart decisions, rewrite instructions, forget why a workflow was approved, and become dependent on one provider's memory or interface.

Chief AI exists to make useful company intelligence:

1. explicit;
2. structured;
3. versioned;
4. testable;
5. portable;
6. reusable;
7. attributable to evidence and outcomes.

## Product promise

> Turn founder judgment into reusable company infrastructure without surrendering it to one AI provider.

## Core loop

```text
Capture intent
→ create an intelligence asset
→ test or use it
→ record evidence and outcome
→ approve, revise, or retire it
→ reuse it across the business
→ export it without provider lock-in
```

## Core objects

Chief AI owns these product objects:

- **Workspace** — a company or bounded operating context.
- **Project** — a business, client, initiative, or workstream.
- **Intelligence asset** — a prompt, workflow, decision, playbook, benchmark, brand voice, or research artifact.
- **Version** — an immutable historical state of an asset.
- **Evidence** — the source material used to justify an asset or decision.
- **Outcome** — what happened when the asset was used.
- **Provider run** — an optional execution record for one provider/model.
- **Approval state** — draft, tested, approved, or retired.

## Independence tests

Chief AI must remain useful when all of the following are true:

- the user has no GitHub account;
- the user does not write code;
- no Founder Control Room instance exists;
- no L99 runtime exists;
- the preferred model provider changes;
- the current repository names disappear;
- the user manages one business or many unrelated businesses.

A feature that fails these tests may be an integration, but it is not allowed to become the product's identity.

## Product boundaries

### Chief AI: think and preserve

Chief AI defines intent, structures reusable intelligence, compares provider output, preserves decisions, and records outcomes.

### Founder Control Room: authorize and execute

Founder Control Room governs agent missions, repository changes, approvals, deployments, operational evidence, and rollback.

Chief AI may send an approved workflow or decision to Control Room. It must not silently inherit deployment authority.

### L99: verify and protect

L99 enforces provenance, isolation, revocation, promotion controls, and incident evidence for AI runtime state.

Chief AI may use L99 assurance services. It must remain usable without them.

## Non-goals for the first commercial product

Chief AI is not initially:

- an autonomous coding agent;
- a deployment platform;
- a generic note-taking app;
- a team chat product;
- a vector database exposed as a product;
- a marketplace of random prompts;
- a promise that an AI model is a legal, medical, financial, or human cofounder;
- a system that executes irreversible actions without separate approval.

## MVP

The first standalone product must support:

1. workspaces and projects;
2. intelligence asset creation;
3. asset types and approval states;
4. version history;
5. provider-neutral export and import;
6. prompt and workflow building;
7. provider/model comparison records;
8. evidence and outcome notes;
9. private local-first use;
10. a migration path to encrypted account sync.

## Commercial wedge

The initial customer is a founder or small operator who already uses multiple AI tools and has felt at least one of these pains:

- repeating company context in every chat;
- losing high-performing prompts;
- receiving inconsistent output across providers;
- forgetting why a decision was made;
- onboarding collaborators into undocumented founder judgment;
- fearing that one provider shutdown or policy change will erase the operating system.

## Product language

Prefer:

- company intelligence;
- founder judgment;
- reusable operating assets;
- evidence;
- outcomes;
- portability;
- provider-neutral;
- approved workflow;
- decision receipt.

Avoid positioning the entire product as:

- a prompt library;
- a ChatGPT wrapper;
- an AI cofounder that replaces accountability;
- an autonomous business;
- a GitHub dashboard.

## Prime directive

> Use providers. Do not become dependent on them.

Product truth, company memory, private data, decisions, approved workflows, and export rights belong to the customer.
