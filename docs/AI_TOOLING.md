# Chief AI Prompt Machine — MCP and GitHub Models

Chief AI is a prompt-operations system. Tooling should make prompts testable and portable without turning any provider into the owner of project truth or private data.

## MCP servers

- **GitHub:** repository, pull-request, Actions, and security evidence with lockdown mode.
- **Bright Data:** VS Code/Codespaces only, prompted at runtime for `API_TOKEN`, and restricted to `GROUPS=code` for current npm and PyPI package metadata. Pro Mode and broad web/browser groups are not enabled.
- **Microsoft Learn:** current official Microsoft technical documentation and code samples; no authentication required.
- **Figma:** approved interface frames and design context for the prompt-library SPA.
- **Playwright:** pinned isolated Chromium for prompt-builder, benchmark, and browser-state verification.

No Supabase or Cloudflare production MCP is connected because neither is a verified runtime authority for this prototype.

The committed root `.mcp.json` remains credential-free. MCP hosts other than VS Code/Codespaces must configure Bright Data locally and keep the API token outside the repository.

## GitHub Models

GitHub Models is a first-class evaluation lane for committed `.prompt.yml` fixtures.

- The manual workflow uses the automatic `GITHUB_TOKEN` with only `contents: read` and `models: read`.
- Local or Codespaces use may store a fine-grained `models:read` PAT as `GITHUB_MODELS_TOKEN`.
- Never place a token inside a prompt, browser storage, source file, issue, or pull request.

Allowed inputs are versioned prompt templates, invented test fixtures, public documentation, and sanitized benchmark cases. Do not send credentials, private project data, proprietary customer material, real user conversations, unreleased business strategy, or secrets copied from managed repositories.

Model output is evaluation evidence, not a founder decision. It may compare prompt quality, routing, consistency, and safety. It may not silently rewrite the canonical prompt library, publish changes, or mutate another project.
