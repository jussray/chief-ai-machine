# OAuth 2.0 & Security Architecture - Chief AI Machine

## Overview

This OAuth implementation follows security best practices:
- PKCE (Proof Key for Code Exchange) for single-page apps
- Server-side token exchange (secrets never exposed to client)
- Secure httpOnly cookies for session management
- CSRF protection via state parameter
- Safe error messages (no information leakage)

## Security Principles

### 1. Secret Credentials - Server-side Only

```typescript
// ✓ CORRECT: Server-side token exchange
export async function exchangeCodeForToken(
  config: OAuthConfig,
  code: string,
  codeVerifier: string
): Promise<OAuthToken> {
  if (typeof window !== 'undefined') {
    throw new Error('Token exchange must run on server side only') // Explicit check
  }

  // clientSecret stays on server
  const params = new URLSearchParams({
    client_secret: config.clientSecret, // NEVER send to browser
  })
}

// ✗ WRONG: Never do this
const token = await fetch('/api/exchange', {
  body: JSON.stringify({ clientSecret: 'secret' }) // EXPOSED!
})
```

### 2. PKCE (RFC 7636) - Prevents Code Interception

```typescript
// Step 1: Generate code verifier and challenge
const pkce = await generatePKCE()
// codeVerifier: random 128-char string
// codeChallenge: SHA256(codeVerifier), base64url encoded

// Step 2: Send challenge in authorization URL
const authUrl = buildAuthorizationUrl(config, pkce, state)
// https://provider.com/oauth/authorize?code_challenge=...&code_challenge_method=S256

// Step 3: Provider verifies verifier matches challenge
// Exchange code + verifier (proves you initiated the request)
```

**Why PKCE matters:**
- Prevents authorization code interception attacks
- Required for mobile apps and SPAs
- No additional performance cost

### 3. CSRF Protection via State Parameter

```typescript
// Generate random state
const state = generateState() // 32-char random string

// Include in authorization URL
const authUrl = buildAuthorizationUrl(config, pkce, state)
// https://provider.com/oauth/authorize?state=random123...

// Provider redirects: /callback?code=...&state=random123...
// Verify state matches what we sent
if (!verifyState(storedState, callbackState)) {
  throw new Error('CSRF attack detected')
}
```

### 4. Session Security

```typescript
// Store session server-side
const session = createSession(userId, user, token)
// In-memory (production: use Redis/database)

// Return only session ID in secure cookie
res.cookie('sessionId', session.id, {
  secure: true, // HTTPS only
  httpOnly: true, // Not accessible from JavaScript
  sameSite: 'strict', // Same-site only
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
})

// Token never leaves server
// Client only holds session ID
```

### 5. Token Management

```typescript
// Check expiration before use
if (!isTokenValid(token)) {
  token = await refreshAccessToken(config, token.refreshToken)
}

// Never log tokens
// Never serialize to localStorage
// Never send to untrusted endpoints
```

## Environment Setup

### 1. Create .env.local (git-ignored)

```bash
# OAuth - GitHub
OAUTH_GITHUB_CLIENT_ID=your_github_app_id
OAUTH_GITHUB_CLIENT_SECRET=your_github_secret_key
OAUTH_GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/callback/github
OAUTH_GITHUB_TOKEN_ENDPOINT=https://github.com/login/oauth/access_token
OAUTH_GITHUB_AUTHORIZATION_ENDPOINT=https://github.com/login/oauth/authorize
OAUTH_GITHUB_USERINFO_ENDPOINT=https://api.github.com/user
OAUTH_GITHUB_REVOKE_ENDPOINT=https://api.github.com/applications/revoke

# Session
SESSION_SECRET=min_32_chars_random_string_here
```

### 2. Add to .gitignore

```gitignore
.env.local
.env.*.local
.env
```

## Implementation Flow

### User Clicks "Login with GitHub"

```
1. Frontend: GET /api/auth/login/github
   ↓
2. Backend:
   - Generate PKCE (code_challenge, code_verifier)
   - Generate state (CSRF token)
   - Store both in session
   - Redirect to GitHub authorization URL
   ↓
3. GitHub: User authorizes
   ↓
4. GitHub redirects: /api/auth/callback/github?code=...&state=...
   ↓
5. Backend:
   - Verify state (CSRF check)
   - Exchange code + code_verifier for token (server-side)
   - Fetch user info
   - Create session
   - Return session ID in secure cookie
   ↓
6. Frontend: Redirected to /dashboard (authenticated)
```

## API Usage

### Login

```html
<a href="/api/auth/login/github">Login with GitHub</a>
```

### Protected Route

```typescript
app.get('/api/protected', requireAuth, (req, res) => {
  // req.session contains user data
  res.json({ user: req.session.user })
})
```

### Logout

```typescript
fetch('/api/auth/logout', { method: 'POST' })
```

### Get Current User

```typescript
const response = await fetch('/api/auth/me')
const { user } = await response.json()
```

## Security Checklist

- [x] PKCE enabled
- [x] State parameter for CSRF protection
- [x] Server-side token exchange
- [x] Secure httpOnly cookies
- [x] Safe error messages
- [x] Token expiration checks
- [x] Session validation
- [x] Environment variable validation
- [ ] Add rate limiting on auth endpoints
- [ ] Add logging/monitoring
- [ ] Add token revocation on logout
- [ ] Add device verification
- [ ] Add suspicious activity detection

## Files

- `src/oauth/security.ts` - Core OAuth logic (PKCE, token exchange)
- `src/oauth/session.ts` - Session management
- `src/oauth/errors.ts` - Error handling
- `src/oauth/config.ts` - Configuration loading
- `src/oauth/routes.ts` - Express endpoints
- `docs/OAUTH_SECURITY.md` - This guide

## Testing

```bash
# Test OAuth flow
curl -X GET http://localhost:3000/api/auth/login/github

# Test protected route
curl -X GET http://localhost:3000/api/protected \
  -H "Cookie: sessionId=xxx"

# Test logout
curl -X POST http://localhost:3000/api/auth/logout
```

## Troubleshooting

### "Missing OAuth configuration"
```
Error: Missing OAuth configuration: OAUTH_GITHUB_CLIENT_ID, ...
```
**Solution:** Add all required variables to .env.local

### "State mismatch"
```
Error: OAuthError: State mismatch
```
**Solution:** Session not persisted between requests. Check session middleware configuration.

### "Token exchange failed"
```
Error: Token exchange failed: Unauthorized
```
**Solution:** Check clientSecret and client_id match in provider dashboard.

## References

- [OAuth 2.0 Authorization Code Flow](https://tools.ietf.org/html/rfc6749#section-1.3.1)
- [PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)
- [OAuth Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [OWASP - OAuth 2.0 Security](https://cheatsheetseries.owasp.org/cheatsheets/OAuth_2_0_Cheat_Sheet.html)
