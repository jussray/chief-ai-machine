/**
 * OAuth Error Handling
 * Secure error responses that don't leak sensitive info
 */

export enum OAuthErrorCode {
  INVALID_REQUEST = 'invalid_request',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  ACCESS_DENIED = 'access_denied',
  UNSUPPORTED_RESPONSE_TYPE = 'unsupported_response_type',
  INVALID_SCOPE = 'invalid_scope',
  SERVER_ERROR = 'server_error',
  TEMPORARILY_UNAVAILABLE = 'temporarily_unavailable',
  INVALID_CLIENT = 'invalid_client',
  INVALID_GRANT = 'invalid_grant',
  UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type',
}

export class OAuthError extends Error {
  constructor(
    public code: OAuthErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'OAuthError'
  }

  /**
   * Get safe error message for client
   * Never expose internal details
   */
  getSafeMessage(): string {
    switch (this.code) {
      case OAuthErrorCode.INVALID_REQUEST:
        return 'Invalid request. Please try again.'
      case OAuthErrorCode.UNAUTHORIZED_CLIENT:
        return 'Client not authorized. Please contact support.'
      case OAuthErrorCode.ACCESS_DENIED:
        return 'You denied the request. Please try again to authorize.'
      case OAuthErrorCode.INVALID_SCOPE:
        return 'Invalid permissions requested.'
      case OAuthErrorCode.SERVER_ERROR:
      case OAuthErrorCode.TEMPORARILY_UNAVAILABLE:
        return 'Service temporarily unavailable. Please try again later.'
      default:
        return 'Authentication failed. Please try again.'
    }
  }

  /**
   * Log sensitive details server-side only
   */
  logDetails(): void {
    console.error('[OAuth Error]', {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Safe error response for API
 */
export function createErrorResponse(error: OAuthError) {
  error.logDetails()

  return {
    error: error.code,
    error_description: error.getSafeMessage(),
  }
}
