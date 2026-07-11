# Figma Operating Guide

Use Figma as the interface-system and design-handoff layer for the Chief AI ecosystem.

Figma defines approved visual behavior. It does not silently redefine product architecture, privacy rules, backend behavior, or data ownership.

## Best Role

Use Figma for:

- screen flows and interaction states;
- responsive layouts;
- component systems;
- design tokens and themes;
- accessibility-aware visual states;
- developer handoff;
- visual continuity across products.

## Required Inputs

Before designing:

1. identify the exact product and user side;
2. inspect existing screens, components, tokens, and approved references;
3. identify device size and responsive targets;
4. list required states, including empty, loading, error, offline, blocked, private, and success states;
5. preserve current product boundaries and privacy rules.

## Mode Handling

### `/garyvee`

Make the value obvious quickly. Reduce visual friction, clarify the next action, and design assets that can support launch and distribution without misrepresenting the product.

### `lindymode`

Prefer clear hierarchy, familiar controls, accessible patterns, reusable tokens, and simple components over trendy interactions that age badly.

### `redteam`

Inspect deceptive affordances, accidental disclosure, unsafe defaults, inaccessible contrast, hidden destructive actions, confusing identity states, and flows that imply capabilities the product lacks.

### `l99`

Protect visual continuity, component provenance, token ownership, state coverage, and the relationship between one screen and the larger product system.

### `ooda`

- **Observe:** current screens, tokens, requirements, and user context.
- **Orient:** flow, hierarchy, states, safety, and implementation constraints.
- **Decide:** approved layout and component behavior.
- **Act:** produce frames, components, tokens, annotations, and handoff evidence.

## Project Guardrails

### Se’kret Bip

- Respect teen privacy, parent boundaries, anonymous public identity, trusted visibility, and emotional-safety states.
- Do not expose private names or counts in public contexts.
- Treat room backgrounds and companion states as a system, not random decoration.
- Design for phone-first use and real screen constraints.

### Chief AI

- Distinguish prototype UI from authenticated production behavior.
- Do not design a “secure” control room without showing the actual access, session, loading, error, and authorization states needed to support that claim.

### JBH

- Keep commerce flows clear, trustworthy, and accessible.
- Do not hide pricing, shipping, stock, or checkout consequences.

### L99

- Keep public product outcomes clear. Internal engine concepts should not overwhelm the user-facing workflow.

## Handoff Requirements

Every approved handoff should include:

- frame dimensions;
- responsive behavior;
- component names and variants;
- token references;
- interaction and navigation notes;
- data and permission assumptions;
- empty, loading, error, and restricted states;
- accessibility notes;
- asset export names and locations;
- differences from current implementation.

## Prohibited Behavior

- inventing backend behavior;
- changing identity or privacy policy through visuals;
- untraceable one-off colors and spacing;
- decorative mockups with no states or implementation notes;
- handing developers six screenshots and the spiritual instruction to “make it feel premium.”
