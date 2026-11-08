/**
 * Environment Configuration
 * Validates OAuth credentials are loaded correctly
 */

export interface OAuthEnvironment {
  clientId: string
  clientSecret: string
  redirectUri: string
  tokenEndpoint: string
  authorizationEndpoint: string
  userInfoEndpoint: string
  revokeEndpoint: string
}

/**
 * Load and validate OAuth configuration from environment
 */
export function loadOAuthConfig(provider: string): OAuthEnvironment {
  const prefix = `OAUTH_${provider.toUpperCase()}`

  const clientId = process.env[`${prefix}_CLIENT_ID`]
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]
  const redirectUri = process.env[`${prefix}_REDIRECT_URI`]
  const tokenEndpoint = process.env[`${prefix}_TOKEN_ENDPOINT`]
  const authorizationEndpoint = process.env[`${prefix}_AUTHORIZATION_ENDPOINT`]
  const userInfoEndpoint = process.env[`${prefix}_USERINFO_ENDPOINT`]
  const revokeEndpoint = process.env[`${prefix}_REVOKE_ENDPOINT`]

  // Validate all required fields
  const missing = []
  if (!clientId) missing.push(`${prefix}_CLIENT_ID`)
  if (!clientSecret) missing.push(`${prefix}_CLIENT_SECRET`)
  if (!redirectUri) missing.push(`${prefix}_REDIRECT_URI`)
  if (!tokenEndpoint) missing.push(`${prefix}_TOKEN_ENDPOINT`)
  if (!authorizationEndpoint) missing.push(`${prefix}_AUTHORIZATION_ENDPOINT`)
  if (!userInfoEndpoint) missing.push(`${prefix}_USERINFO_ENDPOINT`)
  if (!revokeEndpoint) missing.push(`${prefix}_REVOKE_ENDPOINT`)

  if (missing.length > 0) {
    throw new Error(`Missing OAuth configuration: ${missing.join(', ')}`)
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
    tokenEndpoint: tokenEndpoint!,
    authorizationEndpoint: authorizationEndpoint!,
    userInfoEndpoint: userInfoEndpoint!,
    revokeEndpoint: revokeEndpoint!,
  }
}

/**
 * Example .env.local file
 */
export const ENV_TEMPLATE = `
# OAuth - GitHub
OAUTH_GITHUB_CLIENT_ID=your_github_client_id
OAUTH_GITHUB_CLIENT_SECRET=your_github_client_secret
OAUTH_GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/callback/github
OAUTH_GITHUB_TOKEN_ENDPOINT=https://github.com/login/oauth/access_token
OAUTH_GITHUB_AUTHORIZATION_ENDPOINT=https://github.com/login/oauth/authorize
OAUTH_GITHUB_USERINFO_ENDPOINT=https://api.github.com/user
OAUTH_GITHUB_REVOKE_ENDPOINT=https://api.github.com/applications/revoke

# OAuth - Google
OAUTH_GOOGLE_CLIENT_ID=your_google_client_id
OAUTH_GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
OAUTH_GOOGLE_TOKEN_ENDPOINT=https://oauth2.googleapis.com/token
OAUTH_GOOGLE_AUTHORIZATION_ENDPOINT=https://accounts.google.com/o/oauth2/v2/auth
OAUTH_GOOGLE_USERINFO_ENDPOINT=https://openidconnect.googleapis.com/v1/userinfo
OAUTH_GOOGLE_REVOKE_ENDPOINT=https://oauth2.googleapis.com/revoke

# OAuth - GitHub App (for token refresh)
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=your_private_key

# Session
SESSION_SECRET=very_long_random_secret_key_min_32_chars
`
