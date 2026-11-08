/**
 * OAuth Server Routes
 * Protected endpoints for token exchange and callback
 */

import { Router, Request, Response, NextFunction } from 'express'
import {
  generatePKCE,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  verifyState,
  generateState,
  OAuthToken,
} from './security'
import { createSession, getSession, deleteSession, SESSION_COOKIE_OPTIONS } from './session'
import { createErrorResponse, OAuthError, OAuthErrorCode } from './errors'
import { loadOAuthConfig } from './config'

const router = Router()

/**
 * Extend Express Request type for session
 */
declare global {
  namespace Express {
    interface Request {
      sessionId?: string
      session?: any
    }
  }
}

/**
 * Step 1: Initiate OAuth flow
 * GET /auth/login/:provider
 */
router.get('/login/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params

    // Load provider config
    const config = loadOAuthConfig(provider)

    // Generate PKCE parameters
    const pkce = await generatePKCE()

    // Generate state for CSRF protection
    const state = generateState()

    // Store in session for later verification
    req.session.pkce = pkce
    req.session.state = state

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(config, pkce, state)

    // Redirect to provider's login page
    res.redirect(authUrl)
  } catch (error) {
    console.error('Login initiation error:', error)
    res.status(500).json({
      error: 'login_failed',
      message: 'Failed to initiate login',
    })
  }
})

/**
 * Step 2: Handle OAuth callback
 * GET /auth/callback/:provider?code=...&state=...
 */
router.get('/callback/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params
    const { code, state, error, error_description } = req.query

    // Handle provider error
    if (error) {
      throw new OAuthError(
        error as OAuthErrorCode,
        error_description as string
      )
    }

    // Validate callback parameters
    if (!code || !state) {
      throw new OAuthError(
        OAuthErrorCode.INVALID_REQUEST,
        'Missing code or state'
      )
    }

    // Verify state to prevent CSRF
    if (!verifyState(req.session.state, state as string)) {
      throw new OAuthError(
        OAuthErrorCode.INVALID_REQUEST,
        'State mismatch'
      )
    }

    // Load provider config
    const config = loadOAuthConfig(provider)

    // Exchange code for token (server-side)
    const token = await exchangeCodeForToken(
      config,
      code as string,
      req.session.pkce.codeVerifier
    )

    // Fetch user info
    const userResponse = await fetch(config.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    })

    if (!userResponse.ok) {
      throw new OAuthError(
        OAuthErrorCode.SERVER_ERROR,
        'Failed to fetch user info'
      )
    }

    const userData = await userResponse.json()

    // Create or update user in database
    const user = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatar: userData.avatar_url || userData.picture,
      metadata: userData,
    }

    // Create session
    const session = createSession(user.id, user, token)

    // Set secure session cookie
    res.cookie('sessionId', session.id, SESSION_COOKIE_OPTIONS)

    // Clear temporary OAuth state
    delete req.session.pkce
    delete req.session.state

    // Redirect to dashboard
    res.redirect('/dashboard')
  } catch (error) {
    if (error instanceof OAuthError) {
      const errorResponse = createErrorResponse(error)
      res.status(400).json(errorResponse)
    } else {
      console.error('Callback error:', error)
      res.status(500).json({
        error: 'callback_failed',
        message: 'Failed to process callback',
      })
    }
  }
})

/**
 * Logout
 * POST /auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.sessionId

    if (sessionId) {
      deleteSession(sessionId)
    }

    res.clearCookie('sessionId')
    res.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'logout_failed' })
  }
})

/**
 * Get current user
 * GET /auth/me
 */
router.get('/me', (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.sessionId

    if (!sessionId) {
      return res.status(401).json({ error: 'not_authenticated' })
    }

    const session = getSession(sessionId)

    if (!session) {
      return res.status(401).json({ error: 'invalid_session' })
    }

    res.json({
      user: session.user,
      sessionId: session.id,
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'failed_to_get_user' })
  }
})

/**
 * Middleware: Require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.cookies.sessionId

    if (!sessionId) {
      return res.status(401).json({ error: 'authentication_required' })
    }

    const session = getSession(sessionId)

    if (!session) {
      return res.status(401).json({ error: 'session_expired' })
    }

    req.sessionId = sessionId
    req.session = session

    next()
  } catch (error) {
    res.status(500).json({ error: 'auth_error' })
  }
}

export default router
