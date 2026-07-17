---
name: figma-build-implement
description: Build and implement Chief AI prompt-builder and orchestration interfaces through Figma without misrepresenting the current static SPA as a secure private AI backend.
---

# Chief AI Figma Build + Implementation

Load for every Figma, prototype, design-system, visual builder, design-to-code, visual QA, or Code Connect task in this repository.

## Tool skills

- Load `figma-use` before every Figma write.
- Load `figma-generate-library` for tokens, variables, reusable components, variants, themes, or library reconciliation.
- Use `figma-generate-design` only for first capture of a running web view into an existing file; rebuild editable structure with `figma-use`.
- Use `figma-code-connect` only after published components, plan eligibility, exact node URLs, and a verified code component exist.

## Repository profile

- Current verified product shape must be rechecked before work. The recorded baseline is a vanilla JavaScript SPA with browser-local prompt builders, prompt library, benchmarks, stars, and theme state.
- Primary design targets: prompt library, structured builder, freestyle builder, benchmark/readout, orchestration concepts, provider-neutral status, and future authenticated/private control surfaces.
- Implement against the current HTML/CSS/JavaScript architecture unless the repository has explicitly adopted another framework.
- Figma can specify future private/backend states, but they must be labeled planned and cannot be represented as implemented.

## Required sequence

1. Run 5W1H and the Chief AI founder loop.
2. Redteam the premise: ornamental dashboard, provider lock-in, private prompts in client code, fake model execution, duplicate builders, and architecture inflation.
3. Inspect current DOM, modules, prompt data, storage, tests, deployment boundary, and existing Figma libraries.
4. Lock whether the task is current-SPA implementation, design-only future state, or a separately approved architecture change.
5. Reuse existing components and Simple Design System assets where APIs fit. Create local tokens/components only when they are owned and implementable.
6. Implement current-state work in the existing SPA; do not add a frontend framework or private backend merely to match a mockup.
7. Redteam the selected implementation: local-storage assumptions, public prompt exposure, key leakage, fake provider state, inaccessible flows, and rollback.
8. Verify with current type/static checks, lint, unit tests, browser behavior, and Playwright when applicable.
9. Report Figma nodes, exact code mapping, current versus planned states, tests, drift, rollback, and next gate.

## Data and authority boundary

- Never place proprietary prompt libraries, private founder prompts, model keys, credentials, privileged provider responses, or customer/project private data into Figma.
- Use synthetic prompt examples and public-safe benchmark fixtures.
- Do not imply authenticated persistence, private model execution, multi-user isolation, billing, or secure server storage without verified backend proof.
- Keep providers replaceable.

## Code Connect

Code Connect is optional. The current SPA should not gain a component framework solely for mapping. Use it only if reusable components are published and corresponding code modules have stable APIs.

## Definition of done

The editable design, current/planned classification, code implementation status, accessibility, tests, security boundary, unresolved drift, rollback, and next founder gate are explicit. A prototype is not a secure production control room.