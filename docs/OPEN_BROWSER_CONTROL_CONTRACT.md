# Open Browser Control Contract

## Purpose

Chief AI and connected Control Rooms may use an approved browser-control surface to inspect and operate web-only systems when no direct native connector exists.

## Fallback order

1. Use a direct provider connector when available.
2. Otherwise use an approved Open Browser, browser-control, computer-use, MCP, or equivalent UI-control connector.
3. Otherwise use a provider-held API bridge already configured for the workflow.
4. Otherwise provide exact manual steps and record the blocked path.

## ChatGPT and Zapier

When ChatGPT has no native Zapier connector, the approved bridge is the existing `@OpenAI Developers` / OpenAI Platform connection used by the preconfigured Founder Signal Engine workflow. The dedicated key reference is `zapier-founder-signal-engine`.

The raw key must never be exposed. It authenticates OpenAI inside Zapier, but it does not itself grant Zapier UI control, publication authority, CRM authority, billing authority, credential authority, or deletion authority.

## Browser-control scope

An approved agent may open and inspect the named workflow, test non-destructive steps, repair mappings, verify connected accounts, and capture evidence when the target and action are explicitly scoped and auditable.

Publication, outreach, CRM writes, billing, credential changes, account ownership changes, and deletion remain separate founder gates.

## Evidence required

Record the target, action, before state, after state, run ID, safe screenshots, rollback step, and blocked conditions. Browser access is not proof of a full pass. The full chain still requires source evidence, workflow-run evidence, model output, downstream provider status, CRM association, and Control Room evidence.
