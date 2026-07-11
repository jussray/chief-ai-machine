# Platform Routing

Chief AI routes work to the tool best suited for the job while keeping knowledge, prompts, data, and decisions portable.

## Core rule

**Use them. Do not depend on them.**

No provider owns the architecture. Provider-specific strengths belong behind replaceable workflows, adapters, or documented handoffs.

## Shared requirements

Every platform must:

- follow `docs/OPERATING_MODES.md`;
- preserve project boundaries;
- distinguish verified fact from inference;
- avoid exposing secrets or private data;
- state what it could and could not inspect;
- avoid claiming actions it did not perform;
- identify approval gates before risky changes;
- leave durable output in files, schemas, commits, or documented decisions when appropriate.

## Routing table

| Platform | Best use | Do not rely on it for |
|---|---|---|
| Claude / Claude Code | long-context repository analysis, implementation, structured plans, careful refactors | unseen dashboard state, unverified deployment facts, automatic production approval |
| ChatGPT / Codex | deep reasoning, code review, debugging, data analysis, agentic repository work | silently remembered source of truth, exposed client-side secrets, unsupported current facts |
| Perplexity | current web research, market scans, competitor research, source discovery | private repository truth unless connected, uncited implementation claims, production writes |
| GitHub | repository evidence, branch and PR workflows, CI history, review, provenance | runtime truth outside GitHub, dashboard state, proof that a merge deployed successfully |
| Figma | interface systems, components, flows, tokens, visual handoff | backend architecture, security policy, hidden application behavior |
| Canva | marketing assets, social content, pitch visuals, brand adaptation | product source of truth, code changes, infrastructure claims |
| Shopify | store operations, catalog, theme, commerce configuration | general application backend, private AI orchestration, secret handling in storefront code |

## Full founder stack routing

For:

```text
/garyvee lindymode redteam l99 redteam ooda
```

route the work as follows:

1. **GaryVee frame:** use product truth and founder intent to define the audience, value, outcome, and fastest truthful proof.
2. **Lindy screen:** keep data, decisions, prompts, and interfaces portable before selecting a provider.
3. **Redteam I:** use repository evidence, current research, and product boundaries to challenge the premise.
4. **L99 pass:** map continuity, provenance, state, memory, runtime, dependencies, release, and long-term drift across tools.
5. **Redteam II:** attack the chosen handoff and implementation plan, including blast radius, rollback, recovery, and proof.
6. **OODA:** send the smallest approved action to the appropriate execution tool, verify it, and record the result.

## Recommended handoffs

### Research to decision

1. Perplexity gathers current evidence and primary sources.
2. ChatGPT or Claude runs Redteam I against the premise and evaluates the evidence against product reality.
3. ChatGPT or Claude performs the L99 systems pass.
4. Redteam II attacks the selected recommendation, cost, lock-in, failure, and rollback.
5. OODA produces one decision, stop condition, and proof requirement.
6. A repository-writing agent implements only after approval.
7. GitHub preserves the branch, diff, review, and evidence trail.

### Repository change

1. GitHub establishes current branch, recent commits, open pull requests, and source-of-truth ownership.
2. Claude or Codex inspects the relevant code and runs Redteam I against the request.
3. L99 maps dependencies, state, release impact, and long-term drift.
4. Redteam II reviews the proposed diff, blast radius, CI coverage, and rollback.
5. OODA creates the smallest coherent branch and pull request.
6. Merge and deployment remain separate founder approval gates.

### Design to implementation

1. Figma defines the approved flow, tokens, states, and responsive behavior.
2. Claude or Codex maps those decisions to the existing component system.
3. Redteam I checks product truth, privacy, identity, and missing states.
4. L99 checks component continuity, token ownership, and cross-screen drift.
5. Redteam II checks accessibility, unsafe states, implementation mismatch, and regression.
6. Tests and screenshots prove the implementation.
7. GitHub records the exact change and review.

### Content to distribution

1. Product truth and founder intent are established first.
2. `/garyvee` turns the source into audience-specific content.
3. `lindymode` preserves durable brand elements and reusable source assets.
4. Redteam I removes unsupported claims, privacy leaks, and fake urgency.
5. L99 preserves source provenance, campaign history, and brand continuity.
6. Redteam II checks the final asset, destination, call to action, and release status.
7. Canva adapts approved content into visual assets.

### Commerce work

1. Shopify owns storefront and catalog concerns.
2. Application repositories own application behavior.
3. Payment, supplier, customer, and administrative secrets remain server-side and access-controlled.
4. Redteam I challenges the business rule, customer impact, and data boundary.
5. L99 checks catalog, inventory, reward liability, fulfillment, and event continuity.
6. Redteam II checks price, stock, checkout, webhook, rollback, and accounting failure paths.
7. Store changes involving price, billing, live inventory, checkout, or production theme require explicit founder approval.

## Failure and recovery

For every provider-dependent workflow, document:

- exported data format;
- replacement path;
- credentials owner;
- service boundary;
- outage behavior;
- rollback or manual fallback;
- whether the provider stores sensitive information;
- which system remains the source of truth.

A platform being convenient today is not a constitutional amendment.