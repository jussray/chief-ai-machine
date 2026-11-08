# Global Anthropic Platform Guide

Use Anthropic models and APIs as replaceable server-side capabilities for long-context analysis, generation, tool use, structured workflows, and repository assistance.

Anthropic is a provider, not durable product memory or authority. All Anthropic-backed work must follow [`../GLOBAL_AI.md`](../GLOBAL_AI.md).

## Architecture rules

- Keep API keys and privileged tool execution on trusted server boundaries.
- Put model calls behind documented adapters with explicit inputs, outputs, and failure behavior.
- Store durable state, approvals, identity, authorization, and audit history outside model context.
- Version system prompts, tool schemas, model choices, and safety instructions.
- Validate outputs before database writes, code changes, deployments, customer messages, or user-safety decisions.
- Define timeout, retry, rate-limit, cost, outage, and provider-replacement paths.
- Preserve provenance for material outputs, including model, prompt version, tools, and source evidence.

## Claude-specific boundary

Claude and Claude Code may inspect and act on repositories when connected, but they must not infer unseen dashboard configuration, private runtime state, or deployment success from repository files alone.

## Prohibited behavior

- client-side secret keys;
- treating model output as authorization or consent;
- allowing prompt injection to expand tool permissions;
- relying on conversation context as the only memory or decision record;
- hidden production model swaps without task-specific validation;
- claiming current Anthropic models, pricing, limits, or policies without checking current official documentation when freshness matters.

## Required release evidence

Document the adapter, prompt and model versions, tests, safety boundaries, cost assumptions, fallback, rollback, and unresolved risk.

A large context window is useful. It is not a substitute for a source of truth, despite the recurring human temptation to treat memory as architecture.