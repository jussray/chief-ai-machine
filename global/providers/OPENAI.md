# Global OpenAI Platform Guide

Use OpenAI models and APIs as replaceable server-side capabilities for reasoning, generation, moderation, speech, embeddings, and structured outputs.

OpenAI is a provider, not the product’s source of truth. All OpenAI-backed work must follow [`../GLOBAL_AI.md`](../GLOBAL_AI.md).

## Architecture rules

- Keep API keys and privileged calls on trusted server boundaries.
- Put model access behind a documented adapter or service boundary.
- Store durable product state in product-owned databases, files, or event logs, not model context.
- Version prompts, schemas, model choices, and safety behavior.
- Validate structured outputs before using them for writes or user-visible decisions.
- Define timeout, retry, rate-limit, cost, outage, and fallback behavior.
- Record provenance sufficient to explain which model, prompt version, tool set, and source data produced a material result.

## Model use

Choose models by measured task requirements, not loyalty or benchmark theater. Evaluate:

- quality on the actual task;
- latency and cost;
- context requirements;
- tool and structured-output reliability;
- safety behavior;
- data-retention and privacy requirements;
- replacement path.

## Prohibited behavior

- client-side secret keys;
- hidden production model swaps without testing;
- treating model output as authorization;
- letting prompt text override identity, tenancy, RLS, or tool permissions;
- storing sensitive user data in prompts when a minimized representation works;
- claiming an OpenAI feature, model, price, limit, or policy without checking current official documentation when freshness matters.

## Required release evidence

Document the adapter, model and prompt versions, tests, safety checks, cost assumptions, fallback, rollback, and unresolved risk.

The model may be intelligent. The boundary must still be less gullible than a browser extension written at 2 a.m.