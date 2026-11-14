import { loadAppleDeveloperToken, saveAppleDeveloperToken, isValidHttpUrl, type MusicConfig } from '../config'
import { jwtExpiresAt } from './pkce'
import { MusicAuthError } from '../types'

/**
 * Apple Music developer token resolution.
 *
 * The token is a JWT signed by Apple with the developer's .p8 key. BASSX must
 * never hold that key, so it either:
 *   1. fetches a fresh token from the token endpoint the user configured, or
 *   2. uses a token the user pasted for this browser session.
 *
 * Tokens are validated for expiry before they ever reach MusicKit.
 */

const EXPIRY_SKEW_MS = 120_000

export function inspectAppleToken(token: string): {
  expiresAt: number | null
  expired: boolean
} {
  const expiresAt = jwtExpiresAt(token)
  return {
    expiresAt,
    expired: expiresAt == null ? true : expiresAt <= Date.now() + EXPIRY_SKEW_MS,
  }
}

export function validatePastedAppleToken(token: string): string {
  const value = token.trim().replace(/^"|"$/g, '')
  if (!value) {
    throw new MusicAuthError('invalid_token', 'Paste a developer token first.')
  }
  if (value.split('.').length !== 3) {
    throw new MusicAuthError(
      'invalid_token',
      'That does not look like a JWT. Apple developer tokens have three dot-separated parts.',
    )
  }
  const { expiresAt } = inspectAppleToken(value)
  if (!expiresAt) {
    throw new MusicAuthError('invalid_token', 'The token has no readable expiry claim.')
  }
  if (expiresAt <= Date.now()) {
    throw new MusicAuthError(
      'expired_token',
      'That developer token has already expired. Generate a new one from your token endpoint.',
    )
  }
  return value
}

async function fetchTokenFromEndpoint(endpoint: string): Promise<string> {
  if (!isValidHttpUrl(endpoint)) {
    throw new MusicAuthError('missing_config', 'Enter a valid HTTPS token endpoint URL.')
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain;q=0.9' },
      credentials: 'omit',
      cache: 'no-store',
    })
  } catch {
    throw new MusicAuthError(
      'network',
      'Could not reach the Apple Music token endpoint. Check the URL and its CORS policy.',
    )
  }

  if (!response.ok) {
    throw new MusicAuthError(
      'provider',
      `The Apple Music token endpoint returned HTTP ${response.status}.`,
    )
  }

  const text = (await response.text()).trim()
  if (!text) {
    throw new MusicAuthError('invalid_token', 'The token endpoint returned an empty response.')
  }

  let token = text.replace(/^"|"$/g, '')
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>
      const candidate =
        parsed.token ?? parsed.developerToken ?? parsed.appleMusicToken ?? parsed.jwt
      token = typeof candidate === 'string' ? candidate : ''
    } catch {
      throw new MusicAuthError(
        'invalid_token',
        'The token endpoint returned JSON that BASSX could not read. Return { "token": "…" } or plain text.',
      )
    }
  }

  return validatePastedAppleToken(token)
}

/**
 * Returns a developer token that is valid for at least two more minutes.
 * A cached session token is reused until it nears expiry, then the endpoint
 * is called again.
 */
export async function resolveAppleDeveloperToken(
  config: MusicConfig,
): Promise<string> {
  const cached = loadAppleDeveloperToken()
  if (cached) {
    const { expired } = inspectAppleToken(cached)
    if (!expired) return cached
  }

  if (!config.appleTokenEndpoint) {
    throw new MusicAuthError(
      'missing_config',
      'Add an Apple Music token endpoint, or paste a developer token for this session.',
    )
  }

  const token = await fetchTokenFromEndpoint(config.appleTokenEndpoint)
  saveAppleDeveloperToken(token)
  return token
}
