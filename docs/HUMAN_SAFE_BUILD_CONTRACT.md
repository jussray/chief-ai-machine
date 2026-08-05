# Human-Safe Build Contract

This repository is built for the human receiving, choosing, or acting on AI-generated prompts and outputs.

## Core rule

A user-facing prompt builder, route, provider state, generation workflow, or result surface must not resolve to silence when the system knows enough to show a state.

Do not use `return null` for loading, error, empty, denied, offline, unavailable, recovery, or transitional states that can block understanding or action.

## Required human-facing states

Every prompt workflow must provide the applicable state with clear language and an honest next action:

- loading or checking;
- success;
- empty;
- denied or permission-limited;
- offline or degraded;
- error;
- recovery, retry, revise, back, or safe exit.

Never imply that a provider call, prompt transformation, save, copy, publish, or automation action completed when evidence is missing.

## Where `null` remains valid

`null` may remain in data, parser, service, storage, cache, provider, and optional-value contracts when it explicitly means `not found`, `not configured`, or `not applicable`.

That contract must be typed or tested. A human-facing caller must translate it into a visible state whenever the absence affects comprehension, trust, safety, cost, publication, or the next action.

Optional decorative elements may render nothing only when their absence cannot hide progress, failure, denial, important data, or a required action.

## Safe implementation loop

### Observe

Inspect the active prompt path, component, provider adapter, exact branch head, existing tests, and rendered behavior. Distinguish a valid data sentinel from a blank-state defect.

### Orient

Red-team empty inputs, malformed placeholders, unavailable providers, stale drafts, missing credentials, rate limits, network loss, unsafe output, and narrow/mobile layouts.

### Decide

Choose the smallest proven repair. Prefer platform primitives and existing components. Do not add a dependency when plain JavaScript, browser, or server behavior is sufficient.

### Act

Render the missing state, preserve user intent and provider boundaries, add a focused regression test, and run the exact applicable proof gates.

## Proof requirements

- Unit or source-contract proof for the state decision.
- Type, test, and build proof where applicable.
- Playwright proof for changed rendered behavior.
- Exact-head CI evidence before merge.

A screenshot, design mock, or green unrelated workflow is not runtime proof.

## Red-team constraints

Never replace `null` mechanically across a repository. Blind replacement can invent content, conceal provider failure, trigger unsafe automation, or break optional contracts.

Never show a saved, copied, published, automated, or successful state when the underlying operation is unknown or failed.

## Definition of done

The change is complete when the human can tell:

1. what the system is doing;
2. what happened;
3. whether the output and intended action are trustworthy;
4. what they can do next;
5. how to recover when recovery is possible.

Build the smallest safe thing, prove it at the exact head, and leave no human staring into an empty frame.
