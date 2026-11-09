# Chief AI Security Policy

## Security Gates & Cybersecurity Systems

Chief AI implements multi-layered security verification with automated gates that run before deployment.

### Juss Protect 1: Foundation Security

**Gate**: Founder-Chief Pair Contract Verification  
**Command**: `npm run verify:founder-chief-pair`  
**Verifies**:
- V10 Twin Core roles and authority
- Capability selection and boundaries
- Outcomes verification
- Sauce Guard egress controls
- Necessary-fix policy compliance

**Status**: ✅ Required before deployment

---

### Juss Protect 2: Operational Security

**Gate**: Operational Authority & Runtime Identity  
**Command**: `npm run verify:operational-authority`  
**Verifies**:
- Cloudflare runtime identity
- Worker security headers (CSP, X-Frame-Options, XSS protection)
- Cookie contract compliance
- MCP configuration security
- Firewall v10 rules

**Status**: ✅ Required before deployment

---

### Juss Protect 3: Evidence & Proof

**Gate**: Control Room Evidence Verification  
**Command**: `npm run verify:control-room-tests`  
**Verifies**:
- Evidence receipts validity
- Proof provenance chains
- Authority escalation prevention
- Cross-workspace isolation

---

### Juss Protect 4: Egress Control

**Gate**: Sauce Guard Egress Verification  
**Command**: `npm run verify:sauce-guard-egress`  
**Verifies**:
- Only approved external origins allowed
- No credential leakage in requests
- Cloudflare Access enforcement
- Request body sanitization

---

## Automated Security Verification

### Pre-Deployment Checklist

```bash
# Run all security gates (in sequence)
npm run verify:founder-chief-pair
npm run verify:operational-authority
npm run verify:control-room-tests
npm run verify:sauce-guard-egress

# OR run comprehensive security check
npm run typecheck && npm run lint && npm test 2>&1 | grep -E "(PASS|FAIL|security)"
```

### Worker Security Headers

All responses include:
- `Content-Security-Policy-Report-Only` with nonce-based inline script protection
- `X-Frame-Options: DENY` - prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - enables browser XSS filtering
- `X-Content-Type-Options: nosniff` - prevents MIME type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` - controls referrer exposure
- `Permissions-Policy: geolocation=(), microphone=(), camera=()` - blocks sensitive features

### Content Security Policy

CSP headers generated per-request with unique nonce:
- `default-src 'self'` - restrict to same-origin by default
- `script-src 'self' 'nonce-{random}'` - only self and nonce-validated scripts
- `style-src 'self' 'nonce-{random}' https://fonts.googleapis.com` - self, nonce, and fonts
- `frame-ancestors 'none'` - prevent embedding in iframes
- `base-uri 'self'` - restrict base URL to same-origin

---

## Threat Model & Mitigations

### Threat: Cross-Site Scripting (XSS)

**Mitigation**:
- CSP with nonce-based script whitelist
- HTML escaping on all dynamic content
- No inline scripts in SPA
- Content-Security-Policy-Report-Only for safe rollout

---

### Threat: Clickjacking

**Mitigation**:
- `X-Frame-Options: DENY` - prevent framing
- CSP `frame-ancestors 'none'`

---

### Threat: MIME Type Confusion

**Mitigation**:
- `X-Content-Type-Options: nosniff` - force MIME type detection

---

### Threat: Unauthorized Access

**Mitigation**:
- Founder-chief pair contract enforcement
- Operational authority verification
- Runtime identity verification via Cloudflare
- Evidence receipt provenance tracking

---

### Threat: Data Exfiltration

**Mitigation**:
- Sauce Guard egress control (approved origins only)
- Request sanitization (no credentials in URLs)
- Cloudflare Access enforcement
- Cookie contract compliance

---

## Supported Versions

| Version | Supported | Security Updates |
|---------|-----------|------------------|
| 2026.11 | ✅ | Active |
| 2026.10 | ✅ | Active |
| 2026.09 | ⚠️  | Limited |
| < 2026.09 | ❌ | No updates |

---

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

### Responsible Disclosure

1. **Email**: [security contact - to be configured]
2. **Include**:
   - Detailed vulnerability description
   - Affected version(s)
   - Proof of concept (if applicable)
   - Proposed fix (if available)
3. **Timeline**: 
   - We will acknowledge receipt within 24 hours
   - We will provide updates every 7 days
   - We will coordinate disclosure timing

---

## Compliance & Audit

### Security Audit Checklist

- ✅ CSP headers on all responses
- ✅ X-Frame-Options: DENY
- ✅ XSS protection headers
- ✅ MIME type sniffing prevention
- ✅ Referrer policy configured
- ✅ No mixed HTTP/HTTPS content
- ✅ Secure cookie flags (when applicable)
- ✅ CORS policy enforced
- ✅ Rate limiting configured
- ✅ Logging & monitoring enabled

---

## Security Testing

### Automated Tests

```bash
npm run test  # All tests including security contracts
npm run lint  # Code quality and security patterns
```

### Manual Testing

1. **CSP Validation**:
   ```bash
   curl -I https://chief-ai.pages.dev/ | grep -i "content-security-policy"
   ```

2. **Security Headers**:
   ```bash
   curl -I https://chief-ai.pages.dev/ | grep -E "X-Frame|X-XSS|X-Content"
   ```

3. **Playwright Security Gate**:
   ```bash
   npx playwright test e2e/worker-security-gates-3-4.pw.mjs
   ```

---

## Deployment Security Gate

Before deploying to production:

1. **Pre-deployment verification**:
   ```bash
   npm run verify:founder-chief-pair
   npm run verify:operational-authority
   ```

2. **Automated checks**:
   - ESLint security patterns
   - TypeScript strict mode
   - Vitest security contracts
   - Playwright security gates

3. **Deployment verification**:
   - CSP headers present and valid
   - Security headers all present
   - Cloudflare Access authenticated
   - Runtime identity verified

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CSP Level 3 Spec](https://w3c.github.io/webappsec-csp/)
- [Security Headers](https://securityheaders.com/)
- [Founder Control Room - Protected Intelligence Contract](../founder-control-room/SECURITY.md)

---

**Last Updated**: 2026-11-09  
**Next Audit**: 2026-11-23
