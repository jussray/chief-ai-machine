# Chief AI Prompt Machine

Chief AI Prompt Machine is Jussray’s founder prompt-operations system for Se’kret Bip, Think Tank, Juss Beautiful Hair, and L99.

The current application is a vanilla JavaScript SPA containing the prompt library, Builder, Freestyle template selection, benchmarks, and browser-local custom prompt state. Treat it as a prototype until private access control, server-side prompt storage, and real model execution are implemented and verified.

## Founder operating stack

The shared decision protocol is:

```text
/garyvee lindymode redteam l99 redteam ooda
```

The first redteam attacks the premise. The second attacks the chosen implementation plan. The canonical specification is [`docs/OPERATING_MODES.md`](./docs/OPERATING_MODES.md).

## Repository-loaded contracts

- [`CLAUDE.md`](./CLAUDE.md) — Claude and Claude Code repository contract
- [`AGENTS.md`](./AGENTS.md) — Codex, ChatGPT agents, and GitHub-connected repository agents

## Portable global contracts

Copy these into other repositories when the same founder operating contract should apply:

- [`global/GLOBAL_AI.md`](./global/GLOBAL_AI.md) — provider-neutral global contract
- [`global/CLAUDE.md`](./global/CLAUDE.md) — portable Claude repository instructions
- [`global/AGENTS.md`](./global/AGENTS.md) — portable agent repository instructions

Project-local instructions may add stricter rules. They must not weaken privacy, security, evidence, approval, provenance, rollback, or truthfulness requirements.

## Global provider guides

- [`global/providers/CLAUDE.md`](./global/providers/CLAUDE.md)
- [`global/providers/CODEX.md`](./global/providers/CODEX.md)
- [`global/providers/CHATGPT.md`](./global/providers/CHATGPT.md)
- [`global/providers/OPENAI.md`](./global/providers/OPENAI.md)
- [`global/providers/ANTHROPIC.md`](./global/providers/ANTHROPIC.md)
- [`global/providers/PERPLEXITY.md`](./global/providers/PERPLEXITY.md)
- [`global/providers/GITHUB.md`](./global/providers/GITHUB.md)

These distinguish product-level tools such as Claude, Codex, and ChatGPT from provider platforms such as Anthropic and OpenAI. One may be the interface while another owns the API boundary. Apparently naming layers precisely is still cheaper than debugging them later.

## Shared doctrine

- [`docs/OPERATING_MODES.md`](./docs/OPERATING_MODES.md) — founder mode definitions and two-pass redteam sequence
- [`docs/PLATFORM_ROUTING.md`](./docs/PLATFORM_ROUTING.md) — provider roles and cross-tool handoffs

## Platform guides

- [`docs/CHATGPT.md`](./docs/CHATGPT.md)
- [`docs/PERPLEXITY.md`](./docs/PERPLEXITY.md)
- [`docs/GITHUB.md`](./docs/GITHUB.md)
- [`docs/FIGMA.md`](./docs/FIGMA.md)
- [`docs/CANVA.md`](./docs/CANVA.md)
- [`docs/SHOPIFY.md`](./docs/SHOPIFY.md)

The repository-loaded files are instructions for compatible agents. The global provider guides are portable contracts. The platform guides are deeper human-readable handoff documents and may need to be supplied manually to tools that do not automatically read repository files.

## Prime directive

> Use them. Do not depend on them.

Providers are replaceable capabilities. Product truth, project boundaries, private data, durable memory, and founder decisions must remain portable and controlled.
