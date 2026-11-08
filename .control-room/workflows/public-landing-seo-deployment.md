# Workflow: Public Landing Page with Max SEO/Geo/AEO

**Status:** Proven. Deployed on Chief AI (5ce432a).  
**Owner:** Founder (Jussray)  
**Project:** chief-ai-machine  
**Date Established:** 2026-11-08  
**Evidence:** Commit 5ce432a, deployment workflow live

---

## Purpose
Transform an internal-only SPA into a public-facing product with maximum SEO, geographic targeting, and answer engine optimization without sacrificing security or performance.

## Prerequisites
- Existing internal app (SPA with core features)
- Cloudflare Workers deployment
- GitHub Actions CI/CD
- CLOUDFLARE_API_TOKEN in GitHub secrets

## Steps

### 1. Audit Current State
```bash
grep -E "og:|twitter:|schema|json-ld|structured" index.html | wc -l
# Expected: 0 (no SEO infrastructure)
```

### 2. Create Landing Page (New index.html)
**Key elements:**
- Hero section: Clear value prop + CTA
- Feature grid: What you get (map to actual app features)
- Workflow section: Step-by-step user journey
- Multi-platform support: Show integrations (Claude, ChatGPT, Perplexity, etc.)
- CTA section: Conversion-focused call-to-action
- Footer: Branding + links

**Meta tags (required):**
```html
<meta name="description" content="...">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta name="twitter:card" content="summary_large_image">
<meta name="ai-search" content="...">
```

**Structured data (JSON-LD):**
- `@type: SoftwareApplication` (with featureList)
- `@type: Organization` (with founder, contactPoint)
- `@type: FAQPage` (4-6 common questions for answer engines)

### 3. Move App to Separate Route
```bash
cp index.html app.html  # Current app → /app route
# Create new index.html → Public landing page
```

### 4. Update Worker Routing
Add `/app` route handler in worker/index.js:
```javascript
if (url.pathname === '/app' || url.pathname === '/app/') {
  const appRequest = new Request(new URL('/app.html', url), request);
  const response = await env.ASSETS.fetch(appRequest);
  return addSecurityHeaders(response);
}
```

### 5. Add Security Headers
```javascript
function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return new Response(response.body, { ...response, headers });
}
```

### 6. Create SEO Assets
**robots.txt:**
```
User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://chief.foundercontrolroom.org/sitemap.xml

User-agent: GPTBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: Perplexity
Allow: /
```

**sitemap.xml:**
```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://chief.foundercontrolroom.org/</loc><priority>1.0</priority></url>
  <url><loc>https://chief.foundercontrolroom.org/app</loc><priority>0.9</priority></url>
  <!-- Feature pages / sections -->
</urlset>
```

### 7. Commit & Deploy
```bash
git add -A
git commit -m "feat: add public landing page with max SEO/Geo/AEO

- create public landing page matching actual capabilities
- move app to /app route
- add JSON-LD structured data (Organization, SoftwareApplication, FAQPage)
- add robots.txt with answer engine bot allowlists
- add sitemap.xml for search engines
- add security headers (X-Content-Type-Options, X-Frame-Options)"

git push -u origin main
```

### 8. Deploy Workflow Executes
- Wrangler builds with release SHA
- Deploys to Cloudflare Workers
- ProofMode tests verify production
- Artifacts retained

## Verification

**Check live deployment:**
```bash
curl -I https://chief.foundercontrolroom.org/
curl -I https://chief.foundercontrolroom.org/app
```

**Verify structured data:**
- https://search.google.com/test/rich-results (paste URL)
- Schema.org validator (check JSON-LD)

**Answer engine indexing:**
- Claude Web, ChatGPT, Perplexity should discover and cite

## Success Criteria
- ✓ Public landing page live at `/`
- ✓ App accessible at `/app`
- ✓ Zero SEO errors (meta tags, structured data complete)
- ✓ Security headers present on all responses
- ✓ robots.txt allows answer engine bots
- ✓ sitemap.xml discoverable
- ✓ ProofMode production verification green
- ✓ No performance degradation

## Rollback Plan
If deployment fails:
```bash
# Revert last commit
git revert 5ce432a
git push origin main
# Deployment workflow auto-triggers, reverts changes
```

## Reuse Pattern
This workflow applies to any founder tool/SPA that:
1. Has internal-only features
2. Needs public discoverability
3. Requires SEO + AEO optimization
4. Uses Cloudflare Workers + GitHub Actions

**Steps:**
1. Separate landing (index.html) from app (app.html)
2. Add comprehensive meta tags + structured data
3. Update worker routing for `/app`
4. Add robots.txt + sitemap.xml
5. Deploy + verify with ProofMode

## Notes
- Keep landing page lean (<50KB)
- Feature descriptions must match actual app capabilities
- Update sitemap.xml when adding new pages
- Monitor answer engine indexing monthly
- A/B test landing copy based on conversion funnel

---

**Workflow established. Ready for reuse on future projects.**
