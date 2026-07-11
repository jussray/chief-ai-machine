# Platform Routing

Chief AI routes work to the tool best suited for the job while keeping knowledge, prompts, data, and decisions portable.

## Core Rule

**Use them. Do not depend on them.**

No provider owns the architecture. Provider-specific strengths belong behind replaceable workflows, adapters, or documented handoffs.

## Shared Requirements

Every platform must:

- follow `docs/OPERATING_MODES.md`;
- preserve project boundaries;
- distinguish verified fact from inference;
- avoid exposing secrets or private data;
- state what it could and could not inspect;
- avoid claiming actions it did not perform;
- identify approval gates before risky changes;
- leave durable output in files, schemas, commits, or documented decisions when appropriate.

## Routing Table

| Platform | Best use | Do not rely on it for |
|---|---|---|
| Claude / Claude Code | long-context repository analysis, implementation, structured plans, careful refactors | unseen dashboard state, unverified deployment facts, automatic production approval |
| ChatGPT / Codex | deep reasoning, code review, debugging, data analysis, agentic repository work | silently remembered source of truth, exposed client-side secrets, unsupported current facts |
| Perplexity | current web research, market scans, competitor research, source discovery | private repository truth unless connected, uncited implementation claims, production writes |
| Figma | interface systems, components, flows, tokens, visual handoff | backend architecture, security policy, hidden application behavior |
| Canva | marketing assets, social content, pitch visuals, brand adaptation | product source of truth, code changes, infrastructure claims |
| Shopify | store operations, catalog, theme, commerce configuration | general application backend, private AI orchestration, secret handling in storefront code |

## Recommended Handoffs

### Research to decision

1. Perplexity gathers current evidence and sources.
2. ChatGPT or Claude evaluates the evidence against repository and product reality.
3. OODA produces a decision, stop condition, and proof requirement.
4. A repository-writing agent implements only after approval.

### Design to implementation

1. Figma defines the approved flow, tokens, states, and responsive behavior.
2. Claude or Codex maps those decisions to the existing component system.
3. Redteam checks accessibility, privacy, unsafe states, and visual drift.
4. Tests and screenshots prove the implementation.

### Content to distribution

1. Product truth and founder intent are established first.
2. `/garyvee` turns the source into audience-specific content.
3. Canva adapts approved content into visual assets.
4. No platform invents product capabilities, metrics, testimonials, or launch status.

### Commerce work

1. Shopify owns storefront and catalog concerns.
2. Application repos own application behavior.
3. Payment, supplier, customer, and administrative secrets remain server-side and access-controlled.
4. Store changes involving price, billing, live inventory, checkout, or production theme require explicit founder approval.

## Failure and Recovery

For every provider-dependent workflow, document:

- exported data format;
- replacement path;
- credentials owner;
- service boundary;
- outage behavior;
- rollback or manual fallback;
- whether the provider stores sensitive information.

A platform being convenient today is not a constitutional amendment.
