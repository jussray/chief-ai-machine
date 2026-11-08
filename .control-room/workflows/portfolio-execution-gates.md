# Workflow: Portfolio Execution Gates (1-3)

**Status:** Proven. Executed 2026-11-08 22:35 UTC.  
**Owner:** Founder (Jussray)  
**Evidence:** Think Tank 47080d7, JBH maintained, Sekret-Bip tracking live

---

## Purpose
Execute three concurrent portfolio gates in sequence: (1) Apply SEO/Geo/AEO to next product launch, (2) Verify existing product stability, (3) Track in-progress feature completion.

## Prerequisites
- 3 active projects at different stages (public launch, maintenance, feature dev)
- Portfolio continuity audit completed
- Reusable SEO workflow available (Chief AI: public-landing-seo-deployment)

## Steps

### Gate 1: Product Launch — Apply SEO/Geo/AEO Workflow
**Project:** Think Tank (Increment 3 public launch)

1. Audit current landing page:
   ```bash
   grep -c "og:\|twitter:\|description\|schema\|json-ld" landing.html
   ```

2. Enhance landing.html with full AEO stack:
   - Twitter/X cards (summary_large_image)
   - AI-search meta tag (Claude, ChatGPT, Perplexity)
   - Geographic/hreflang tags
   - Enhanced JSON-LD (SoftwareApplication + FAQPage)

3. Update robots.txt with answer engine bot allowlists:
   ```
   User-agent: GPTBot
   Allow: /
   User-agent: Claude-Web
   Allow: /
   User-agent: Perplexity
   Allow: /
   User-agent: CCBot
   Allow: /
   ```

4. Update sitemap.xml with priorities and change frequencies

5. Commit and push:
   ```bash
   git add landing.html robots.txt sitemap.xml
   git commit -m "feat(seo): add comprehensive AEO/Geo optimization for launch"
   git push origin main
   ```

**Result:** Product ready for public launch with max SEO/Geo/AEO

### Gate 2: Product Maintenance — Verify Stability
**Project:** JBH (existing commerce platform)

1. Check recent commits:
   ```bash
   git log --oneline -3
   ```

2. Verify security infrastructure:
   - CodeQL + dependabot configured?
   - Recent security updates applied?
   - Production CI properly bound?

3. Assessment criteria:
   - ✓ Active security maintenance (latest deps)
   - ✓ CI/CD properly configured
   - ✓ No critical issues

**Result:** Stable. Continue maintenance cycle.

### Gate 3: Feature Development — Track Completion
**Project:** Sekret-Bip (parent linking feature)

1. Check recent feature commits:
   ```bash
   git log --oneline --grep="feature-name" -5
   ```

2. Verify test coverage:
   ```bash
   find test -name "*feature*" -type f | wc -l
   ```

3. Assessment criteria:
   - ✓ Tests driving development (TDD)
   - ✓ Recent commits focused on feature
   - ✓ Comprehensive test coverage

**Result:** In progress. Continue monitoring.

## Parallel Execution
All three gates can run in parallel:
- Gate 1 (30 min): SEO workflow applied to new product launch
- Gate 2 (10 min): Stability verification of maintenance product
- Gate 3 (10 min): Progress check on feature development

Total time: ~30-35 minutes for full portfolio cycle.

## Success Criteria
- ✓ Product 1 enhanced and deployed (SEO/Geo/AEO)
- ✓ Product 2 verified as stable (security, CI/CD, no blockers)
- ✓ Product 3 progressing toward completion (tests, commits, focus)

## Rollback Plan
Each gate is independent:
- **Gate 1 rollback:** `git revert <commit-sha> && git push`
- **Gate 2 rollback:** No action needed (audit only)
- **Gate 3 rollback:** No action needed (tracking only)

## Reuse Pattern
This workflow applies to any portfolio with:
- One product in public launch phase
- One product in maintenance phase
- One product in feature development phase

Execute gates 1-3 sequentially or in parallel. Repeat monthly or per launch cycle.

## Next Gate
After gates 1-3 complete:
1. Monitor product 1 launch metrics (traffic, search visibility, answer engine indexing)
2. Continue product 2 maintenance (deps, security, performance)
3. Drive product 3 to feature completion (track tests, identify blockers)

---

**Workflow established. Ready for deployment at scale across portfolio.**
