/**
 * OAuth 2.0 Security Architecture
 * Secure token management, credential handling, and authorization flows
 */

/**
 * OAuth Credentials - Never expose in code or logs
 * Store in environment variables only
 */
export interface OAuthConfig {
  clientId: string // Public - safe to expose
  clientSecret: string // SECRET - server-side only
  redirectUri: string // Public - registered with provider
  scopes: string[] // Public - requested permissions
  tokenEndpoint: string // Public - provider's token URL
  authorizationEndpoint: string // Public - provider's auth URL
}

/**
 * OAuth Token - Sensitive data
 * Never log, serialize to localStorage, or send to untrusted endpoints
 */
export interface OAuthToken {
  accessToken: string // Main auth token
  refreshToken?: string // Used to get new accessToken
  expiresAt: Date // When accessToken expires
  tokenType: string // Usually "Bearer"
  scope: string[] // Granted permissions
}

/**
 * OAuth User - Minimal PII
 * Only store what you need
 */
export interface OAuthUser {
  id: string // Provider's unique ID
  email?: string // Optional
  name?: string // Optional
  avatar?: string // Optional
  metadata?: Record<string, unknown> // Provider-specific data
}

/**
 * OAuth Flow Stages
 * Each stage validates and verifies
 */
export enum OAuthStage {
  INIT = 'init', // User clicks "Login with X"
  PENDING = 'pending', // Awaiting provider response
  CALLBACK = 'callback', // Provider redirects with code
  EXCHANGE = 'exchange', // Exchange code for token (server)
  COMPLETE = 'complete', // Token validated
  ERROR = 'error', // Failed
}

/**
 * PKCE (Proof Key for Authorization Code Exchange)
 * Prevents authorization code interception
 * Required for mobile and single-page apps
 */
export interface PKCEParams {
  codeChallenge: string // Derived from codeVerifier
  codeChallengeMethod: 'S256' // SHA256
  codeVerifier: string // Random 128-char string
}

/**
 * Generate PKCE parameters for secure OAuth flow
 * @returns PKCE challenge and verifier
 */
export async function generatePKCE(): Promise<PKCEParams> {
  // Generate random 128-character string
  const codeVerifier = generateRandomString(128)

  // Create SHA256 hash
  const buffer = new TextEncoder().encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const codeChallenge = base64UrlEncode(hashArray)

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  }
}

/**
 * Generate cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let result = ''
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)

  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length]
  }

  return result
}

/**
 * Base64 URL encode without padding
 * Used for PKCE and JWTs
 */
function base64UrlEncode(bytes: number[]): string {
  const binary = String.fromCharCode.apply(null, bytes as any)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * OAuth Authorization URL Builder
 * Constructs URL to redirect user to provider's login
 */
export function buildAuthorizationUrl(
  config: OAuthConfig,
  pkce: PKCEParams,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state, // CSRF protection
    code_challenge: pkce.codeChallenge,
    code_challenge_method: pkce.codeChallengeMethod,
  })

  return `${config.authorizationEndpoint}?${params.toString()}`
}

/**
 * OAuth Token Exchange - Server-side only!
 * NEVER expose clientSecret to client
 */
export async function exchangeCodeForToken(
  config: OAuthConfig,
  code: string,
  codeVerifier: string
): Promise<OAuthToken> {
  // This MUST run on server, not browser
  if (typeof window !== 'undefined') {
    throw new Error('Token exchange must run on server side only')
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret, // SECRET!
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  })

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    tokenType: data.token_type,
    scope: data.scope?.split(' ') || [],
  }
}

/**
 * Token Validation
 * Verify token hasn't expired before use
 */
export function isTokenValid(token: OAuthToken): boolean {
  return token.expiresAt > new Date()
}

/**
 * Token Refresh - Server-side
 * Get new access token using refresh token
 */
export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string
): Promise<OAuthToken> {
  if (typeof window !== 'undefined') {
    throw new Error('Token refresh must run on server side only')
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error('Token refresh failed')
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // May not return new refresh token
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    tokenType: data.token_type,
    scope: data.scope?.split(' ') || [],
  }
}

/**
 * State Parameter - CSRF Protection
 * Generate random state and verify in callback
 */
export function generateState(): string {
  return generateRandomString(32)
}

/**
 * Verify state matches to prevent CSRF attacks
 */
export function verifyState(storedState: string, callbackState: string): boolean {
  return storedState === callbackState && storedState.length > 0
}
