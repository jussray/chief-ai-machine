/**
 * Secure Session Management
 * Store tokens server-side, use secure cookies
 */

import type { OAuthToken, OAuthUser } from './security'

export interface Session {
  id: string
  userId: string
  user: OAuthUser
  token: OAuthToken
  createdAt: Date
  expiresAt: Date
}

/**
 * Session Store - In-memory (replace with Redis/DB in production)
 */
const sessions = new Map<string, Session>()

/**
 * Create a new session
 * Should be called after successful token exchange
 */
export function createSession(userId: string, user: OAuthUser, token: OAuthToken): Session {
  const session: Session = {
    id: generateSessionId(),
    userId,
    user,
    token,
    createdAt: new Date(),
    expiresAt: token.expiresAt,
  }

  sessions.set(session.id, session)
  return session
}

/**
 * Get session by ID
 * Called on every authenticated request
 */
export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId)

  // Check if expired
  if (session && session.expiresAt < new Date()) {
    sessions.delete(sessionId)
    return null
  }

  return session || null
}

/**
 * Update session token
 * Called after token refresh
 */
export function updateSessionToken(sessionId: string, token: OAuthToken): Session | null {
  const session = getSession(sessionId)
  if (!session) return null

  session.token = token
  session.expiresAt = token.expiresAt
  sessions.set(sessionId, session)

  return session
}

/**
 * Delete session
 * Called on logout
 */
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId)
}

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return crypto.randomUUID()
}

/**
 * Session Cookie Options
 * Secure defaults for sensitive session data
 */
export const SESSION_COOKIE_OPTIONS = {
  // Send only over HTTPS
  secure: process.env.NODE_ENV === 'production',
  // Not accessible from JavaScript (prevents XSS)
  httpOnly: true,
  // Send only to same site (prevents CSRF)
  sameSite: 'strict' as const,
  // 24 hour expiration
  maxAge: 24 * 60 * 60 * 1000,
  // Root path
  path: '/',
}
