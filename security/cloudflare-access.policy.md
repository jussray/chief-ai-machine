# Chief AI Cloudflare Access Policy

## Overview

This document describes the Cloudflare Access configuration protecting the Chief AI Worker application. Access provides identity-based authorization at the edge, ensuring only authenticated users can reach protected API routes.

## Protected Routes

The following routes are protected by Cloudflare Access policies and require authentication:

- `/api/*` — Chief AI API endpoints
- `/github/*` — GitHub integration routes
- `/version` — Version endpoint
- `/mcp` — MCP service routes
- `/.well-known/security.txt` — Security contact information
- `/auth.md` — Authentication documentation

## Rate Limiting

Protected routes are subject to edge-based rate limiting:

- **Limit:** 120 requests per 60 seconds
- **Scope:** Per IP (CF-Connecting-IP trusted Cloudflare edge identity)
- **Binding:** CHIEF_RATE_LIMITER
- **Applied by:** `security/edge-rate-limit.mjs`

Rate limiting is enforced in `security/chief-edge-entry.js` before any authentication or routing logic. This protects the Worker from rate-based abuse attacks.

## Configuration Files

### Primary Configuration
- **wrangler.jsonc** — Worker runtime configuration
  - Entry point: `security/chief-edge-entry.js`
  - Ratelimit binding: `CHIEF_RATE_LIMITER` (120 req/60s)
  - Asset routes: Public SPA routes served via assets binding
  - Protected routes: Limited to dynamic API/MCP/auth endpoints

### Implementation Modules

#### Edge Entry Point
- **security/chief-edge-entry.js** (26 lines)
  - Imports and orchestrates security modules
  - Applies rate limiting before upstream routing
  - Observes requests for telemetry
  - Routes valid requests to upstream Worker

#### Rate Limiting
- **security/edge-rate-limit.mjs** (50+ lines)
  - Enforces per-IP rate limits using Cloudflare's native binding
  - Uses CF-Connecting-IP (trusted Cloudflare edge identity)
  - Applies limits only to dynamic paths
  - Returns 429 response when limit exceeded

#### Reciprocal Ingress & Defense
- **security/reciprocal-ingress.mjs** (200+ lines)
  - Observes incoming requests for pattern analysis
  - Emits telemetry events for security monitoring
  - Detects suspicious request patterns
  - Provides synthetic response for early bailout

- **security/reciprocal-defense.mjs** (100+ lines)
  - Evaluates defense policies
  - Enforces access controls
  - Manages allowed/denied patterns
  - Returns policy-based responses

#### Attack Pattern Detection
- **security/full-attack-unit.mjs** (150+ lines)
  - Analyzes request patterns for known attacks
  - Maintains pattern database
  - Provides heuristic-based blocking
  - Integrates with defense module

## Deployment Architecture

```
User Request
    ↓
Cloudflare Access (authentication check)
    ↓
security/chief-edge-entry.js (edge entry point)
    ↓
security/edge-rate-limit.mjs (rate limit check)
    ↓
security/reciprocal-ingress.mjs (pattern observation)
    ↓
security/reciprocal-defense.mjs (policy enforcement)
    ↓
security/full-attack-unit.mjs (attack detection)
    ↓
worker/index.js (upstream Worker)
    ↓
Response to user
```

## Rollback Procedure

If security issues arise, rollback is straightforward:

1. **Revert wrangler.jsonc change** — Set main back to `"worker/index.js"` and remove ratelimit binding
2. **Disable Access policies** — In Cloudflare dashboard, disable protected routes temporarily
3. **Remove edge modules** — Security modules can be safely removed without breaking upstream Worker

Example rollback commit:
```bash
git revert <commit-hash>
wrangler deploy
```

## Testing

Rate limiting can be tested locally with wrangler:

```bash
# Start local worker
wrangler dev

# Test rate limit (should return 429 after 120 requests/minute)
for i in {1..125}; do
  curl http://localhost:8787/api/test
done
```

## Monitoring

Security events are logged via telemetry:
- Request patterns (IP, path, headers, timing)
- Rate limit violations
- Policy enforcement decisions
- Attack pattern detections

Logs are available in Cloudflare dashboard under Worker Logs.

## Approval & Governance

This configuration implements the Chief AI security policy approved by the FCR (Founder Control Room). Changes to protected routes, rate limits, or Access policies require explicit founder approval per CLAUDE.md governance gates.

See CLAUDE.md for:
- Approval gates for security changes
- Sauce Guard requirements for public visibility
- Rollback procedures
- Governance compliance
