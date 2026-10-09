# Claude session state — Chief AI

Last verified: 2026-10-09

## Current implementation truth

**Repository state:** Main branch stable, browser-only SPA prototype.

**Architecture reality:**
- Prompt Library: browser-local only
- Builder: structured composition, no backend
- Freestyle: template selection and filling
- Company Brain: localStorage-backed, not persistent across devices
- Custom prompts: browser-local drafts
- No private backend authentication yet
- No database persistence yet
- No deployment runtime yet

**Verified capabilities:**
- GitHub MCP for code inspection
- Context7 MCP for documentation
- Playwright for isolated testing
- Prompt construction and validation
- Local storage of draft prompts

**Deliberately excluded (prototype boundary):**
- Supabase or other database MCP until backend design approved
- Cloudflare Observability until deployed runtime exists
- Figma/Canva as default MCPs
- Private prompt storage on server
- Cross-device state sync
- Authentication backend

## Documentation status

- README.md: Current, accurately describes standalone peer status
- CLAUDE.md: Current, enforces provider-spend mode and merge authority rules
- MCP_STACK.md: Updated 2026-10-09, accurate (prototype SPA with browser-local state)
- PORTFOLIO_MEDIA_MCP_PLAN.md: Status still "proposed" as of October 9; no provider activation
- OPERATING_MODES.md: Current (/ooda, redteam, lindymode, /garyvee, l99)

## Known boundaries

1. **Not a replacement for FCR.** Chief is companion, not subordinate.
2. **No backend = no durable state.** Refresh loses custom prompts.
3. **No credential security.** Do not send secrets through browser.
4. **Prototype classification.** Not production-ready for private company intelligence.
5. **Provider integration proposed, not live.** Leonardo/Vimeo/Canva not connected.

## Project boundary clarity

Chief AI explicitly keeps clear separation:
- Standalone product, not a module of FCR or PromptOS
- Can interoperate with FCR through explicit contracts only
- Retains independent architecture and product identity
- Does not inherit FCR authority or permissions

## Truth hierarchy applied

1. Code actually present (browser SPA verified)
2. Capabilities actually working (localStorage, MCP connections tested)
3. Documented features not yet implemented (backend, persistence)
4. Future proposals (media MCP, provider integration) clearly marked as proposed
5. No claims about private or secure storage until backend implemented

## Next gates

When backend/persistence work starts:
1. Authentication architecture review
2. Database schema and RLS design
3. Supabase integration testing
4. Cross-device state sync specification
5. Private prompt storage security model
6. FCR integration contracts (if needed)

## For next Claude session

If continuing Chief work:
1. Verify current branch state
2. Check ACTING_BUDGET_MODE.md for provider spend authorization
3. Use CLAUDE.md required stack for architectural decisions
4. Keep browser-local prototype boundary intact until backend design approved
5. Reference FCR for any durable workflow candidacy
