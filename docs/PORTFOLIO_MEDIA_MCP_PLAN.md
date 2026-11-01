# Portfolio Media MCP Plan

**Status:** proposed  
**Owner:** Juss Ray  
**Last verified:** 2026-07-16  
**Parent issue:** https://github.com/jussray/chief-ai-machine/issues/15

## Goal

Give the founder portfolio one controlled way to use AI-assisted image creation and video management across projects without copying credentials into every repository, exposing private data, or making any product depend permanently on one provider.

The target outcome is:

```text
Founder request
→ Chief AI classifies project, purpose, privacy, and budget
→ explicit approval gate
→ official Leonardo or Vimeo MCP connection runs privately
→ human reviews the result
→ approved artifact or public-safe provider ID is exported
→ target product repo consumes the approved output
→ audit metadata and fallback remain available
```

This is a portfolio capability, not a requirement that every repository install every connector.

## Verified provider reality

### Leonardo

Leonardo provides an official MCP endpoint for image generation:

```text
https://mcp.leonardo.ai/v1/mcp
```

The official connector currently requires a Leonardo API key and an API plan. Leonardo web-app access and API access are separate. A paid API activation is therefore a founder approval gate, not an automatic setup step.

### Vimeo

Vimeo provides an official MCP server in public beta.

Claude-compatible endpoint:

```text
https://mcp.vimeo.com/mcp
```

ChatGPT-compatible endpoint documented by Vimeo:

```text
https://mcp.vimeo.com/sse
```

Vimeo states that available functionality and rate limits can vary by membership level. The first action is to test the current account safely before purchasing or upgrading anything.

## Truth-mode decisions

1. **Use both official MCP servers.** Do not install unrelated community Vimeo or Leonardo MCP packages when the vendors provide official endpoints.
2. **Connect them privately at the user/tool level.** Do not commit API keys, bearer headers, access tokens, or authenticated MCP configuration to GitHub.
3. **Chief AI owns routing, not credentials.** Chief AI decides which provider fits a task and records the required approval, privacy class, budget, fallback, and output destination.
4. **Founder Control Room owns governance.** It tracks provider status, approvals, audit metadata, disablement, and rollback without storing raw secrets or sensitive media.
5. **Private creative repos run pilots.** `jbh-private` is the first pilot because it contains private brand/admin work but not teen emotional-wellness data.
6. **Public product repos consume outputs only.** They receive approved image files, thumbnails, video IDs, embed URLs, captions, and accessibility metadata—not provider management credentials.
7. **Se'kret Bip remains the strictest boundary.** No private teen content, identity, journals, recordings, Bridge material, companion conversations, or safety signals may be sent to either provider.
8. **Manual fallback remains first-class.** The portfolio must still work when an MCP server is unavailable, disabled, unaffordable, or removed.

## Broke-founder route

### Phase 0 — no new paid commitment

- Use Leonardo's web experience manually under whatever free allowance is currently available.
- Export and review final images manually.
- Upload or manage non-sensitive Vimeo videos manually under the current account.
- Save only approved image files and public-safe Vimeo references in product repositories.
- Use existing GitHub, Canva, Figma, Cloudflare, Supabase, and Shopify workflows where they already solve the job.

This phase proves that the media itself is useful before automating provider calls.

### Phase 1 — private MCP connection test

- Connect the official Vimeo MCP endpoint privately and verify what the current Vimeo account can actually read or manage.
- Do not upgrade Vimeo unless a blocked, valuable workflow justifies the cost.
- Connect Leonardo MCP only after explicit approval to activate API access or purchase API credits.
- Run one bounded task per provider with non-sensitive test data.
- Record cost, latency, output quality, ownership, exportability, failure behavior, and removal steps.

### Phase 2 — Juss Beautiful Hair pilot

Pilot repository: `jussray/jbh-private`

Proof tasks:

1. Generate one approved campaign image from an approved brand brief through Leonardo.
2. Inspect, organize, caption, or update one non-sensitive product/tutorial video through Vimeo.
3. Export the approved image to the private brand asset area.
4. Record the stable Vimeo asset reference and intended storefront usage.
5. Transfer only approved output metadata to `jussbeautifulhair-site`.
6. Prove the storefront still builds and works when both providers are disconnected.

### Phase 3 — storefront consumption

`jussbeautifulhair-site` and `untold-stories-storefront` may add provider-neutral media shapes such as:

```ts
export type ApprovedImageAsset = {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  provenanceRef?: string;
};

export type PublicVideoAsset = {
  provider: 'vimeo';
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  captionsAvailable?: boolean;
  privacyClass: 'public' | 'unlisted';
};
```

These types intentionally exclude API keys, management tokens, raw provider payloads, private prompts, customer data, and administrative controls.

### Phase 4 — governance and reusable routing

Founder Control Room may represent providers using metadata similar to:

```text
provider
capability
project
status
environment
privacy_class
credential_owner
budget_ceiling
approval_required
manual_fallback
removal_condition
last_verified_at
```

Audit events may record action class, provider, project, result, cost/usage metadata, and an approved artifact reference. They must not record raw secrets, sensitive prompts, private media, or Se'kret Bip user content.

## Repository decisions

| Repository | Leonardo | Vimeo | Decision |
| --- | --- | --- | --- |
| `chief-ai-machine` | Route official MCP tasks | Route official MCP tasks | Portfolio source of truth and workflow router |
| `founder-control-room` | Govern status/approval | Govern status/approval | Metadata and audit only; no credentials or raw media |
| `jbh-private` | First generation pilot | First management pilot | Private creative operations home |
| `jussbeautifulhair-site` | Approved exports only | Public-safe embed metadata | No MCP or management credentials |
| `untold-stories-storefront` | Approved exports only | Public-safe story video playback | No MCP or management credentials |
| `Sekret-Bip` | Offline approved assets only | Public education/demo only | No sensitive content and no default MCP-stack expansion |
| `promptos` | Prompt templates only | Metadata/caption templates only | No live provider authority |
| `l99-StoryEngine` | Not currently needed | Not currently needed | Revisit only when a real runtime consumer exists |
| legacy/demo/duplicate repos | None | None | Do not spread integrations into inactive repositories |

## Security and privacy rules

- Never commit Leonardo keys, Vimeo tokens, OAuth secrets, bearer headers, or authenticated MCP configuration.
- Never put provider secrets in Vite, Expo public variables, browser JavaScript, Shopify storefront code, or GitHub issues.
- Never send customer/order exports, private vendor sourcing, proprietary strategy, or user-generated private content unless a separately reviewed workflow explicitly permits it.
- Never send Se'kret Bip teen identity, journals, voice, video, Bridge material, companion conversations, or safety signals to these providers.
- Require human review before generated assets become product truth or public content.
- Treat provider output as untrusted until reviewed for accuracy, safety, likeness, copyright risk, accessibility, and brand consistency.
- Record a deletion/removal path for every provider-managed asset.

## Approval gates

Separate founder approval is required before:

- purchasing Leonardo API credits or an API plan;
- upgrading Vimeo membership;
- creating or rotating provider credentials;
- enabling provider write access;
- publishing an asset to a public storefront;
- expanding Se'kret Bip's MCP configuration;
- sending any new data class to an external provider;
- enabling automatic or user-facing generation.

Approval for one step does not authorize the next step.

## Success criteria

The portfolio goal is achieved only when all of the following are true:

1. Chief AI can route a media request by project, capability, privacy class, and budget.
2. The official provider connection runs privately without credentials in GitHub.
3. One Juss Beautiful Hair image and one Vimeo workflow complete with recorded evidence.
4. A public storefront consumes only approved output or public-safe provider metadata.
5. Disconnecting either provider does not break the product repository.
6. Founder Control Room can represent provider status, approvals, and disablement without storing secrets.
7. Se'kret Bip has an enforceable boundary preventing sensitive data from entering either provider path.
8. Manual workflows remain documented and usable.

## Stop conditions

Stop or remove an integration when:

- the same value is achieved more cheaply with manual exports or existing tools;
- provider cost exceeds the approved ceiling;
- ownership or deletion terms are unclear;
- the provider requires broader data access than the task justifies;
- outputs are inconsistent enough to create more review work than value;
- sensitive information appears in prompts, logs, output, or audit records;
- the provider becomes a required runtime dependency without an acceptable fallback.

## Implementation issues

- Chief AI master: https://github.com/jussray/chief-ai-machine/issues/15
- Founder Control Room governance: https://github.com/jussray/founder-control-room/issues/26
- Juss Beautiful Hair private pilot: https://github.com/jussray/jbh-private/issues/5
- Juss Beautiful Hair storefront consumption: https://github.com/jussray/jussbeautifulhair-site/issues/13
- Untold Stories media path: https://github.com/jussray/untold-stories-storefront/issues/14
- Se'kret Bip safety boundary: https://github.com/jussray/Sekret-Bip/issues/459

## Official references

- Leonardo MCP documentation: https://docs.leonardo.ai/v1.0/docs/connect-to-leonardoai-mcp
- Vimeo MCP documentation: https://developer.vimeo.com/api/mcp-server

Provider documentation is current-state evidence, not a permanent guarantee. Reverify endpoints, pricing requirements, permissions, and supported tools immediately before activation.
