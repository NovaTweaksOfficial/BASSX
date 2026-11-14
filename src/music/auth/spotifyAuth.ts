import { createState, createVerifier, createCodeChallenge } from './pkce'
import { TokenStore, type TokenSet } from './tokenStore'
import { MusicAuthError } from '../types'

/**
 * Spotify OAuth 2.0 Authorization Code with PKCE.
 *
 * Reference: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 * No client secret is used or accepted. The Client ID is public.
 */

export const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-recently-played',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-follow-read',
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming',
].join(' ')

export const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

const PENDING_KEY = 'bassx.spotify.pkce'
const store = new TokenStore('spotify')

type PendingAuth = {
  verifier: string
  state: string
  redirectUri: string
  createdAt: number
}

type TokenResponse = {
  access_token: string
  token_type?: string
  scope?: string
  expires_in: number
  refresh_token?: string
}

let refreshInFlight: Promise<TokenSet> | null = null

function savePending(pending: PendingAuth): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    /* sessionStorage can be unavailable */
  }
}

function readPending(): PendingAuth | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingAuth>
    if (
      typeof parsed.verifier !== 'string' ||
      typeof parsed.state !== 'string' ||
      typeof parsed.redirectUri !== 'string'
    ) {
      return null
    }
    return {
      verifier: parsed.verifier,
      state: parsed.state,
      redirectUri: parsed.redirectUri,
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0,
    }
  } catch {
    return null
  }
}

function clearPending(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* noop */
  }
}

export async function buildSpotifyAuthorizeUrl(
  clientId: string,
  redirectUri: string,
): Promise<string> {
  const verifier = createVerifier()
  const state = createState()
  const challenge = await createCodeChallenge(verifier)
  savePending({ verifier, state, redirectUri, createdAt: Date.now() })

  const url = new URL(SPOTIFY_AUTHORIZE_URL)
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'false',
  }).toString()
  return url.toString()
}

export function readSpotifyCallback(): {
  code: string | null
  state: string | null
  error: string | null
  errorDescription: string | null
} {
  if (typeof window === 'undefined') {
    return { code: null, state: null, error: null, errorDescription: null }
  }
  const params = new URLSearchParams(window.location.search)
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  }
}

/** Removes OAuth params from the address bar without reloading. */
export function clearSpotifyCallbackUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const params = url.searchParams
  const oauthKeys = ['code', 'state', 'error', 'error_description']
  let touched = false
  oauthKeys.forEach((key) => {
    if (params.has(key)) {
      params.delete(key)
      touched = true
    }
  })
  if (!touched) return
  const query = params.toString()
  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${query ? `?${query}` : ''}${url.hash}`,
  )
}

function toTokenSet(response: TokenResponse, previousRefresh?: string): TokenSet {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? previousRefresh,
    expiresAt: Date.now() + Math.max(30, response.expires_in) * 1000,
    tokenType: response.token_type ?? 'Bearer',
    scope: response.scope,
  }
}

export async function completeSpotifyAuth(
  clientId: string,
  remember: boolean,
): Promise<TokenSet> {
  const callback = readSpotifyCallback()
  const pending = readPending()

  if (callback.error) {
    clearPending()
    clearSpotifyCallbackUrl()
    const description = (callback.errorDescription ?? '').toLowerCase()
    if (description.includes('not registered')) {
      throw new MusicAuthError(
        'provider',
        'Your Spotify account is not registered as a test user for this Development Mode app. Add it under Users and Access in the Spotify dashboard, then try again.',
      )
    }
    if (callback.error === 'access_denied') {
      throw new MusicAuthError(
        'cancelled',
        callback.errorDescription || 'Spotify authorization was cancelled.',
      )
    }
    throw new MusicAuthError(
      'provider',
      callback.errorDescription
        ? `Spotify returned an error: ${callback.errorDescription}`
        : `Spotify returned an error: ${callback.error}`,
    )
  }
  if (!callback.code) {
    throw new MusicAuthError('provider', 'Spotify did not return an authorization code.')
  }
  if (!pending) {
    clearSpotifyCallbackUrl()
    throw new MusicAuthError(
      'state_mismatch',
      'This sign-in started in another tab or the browser cleared its session. Start again from BASSX.',
    )
  }
  if (callback.state !== pending.state) {
    clearPending()
    clearSpotifyCallbackUrl()
    throw new MusicAuthError(
      'state_mismatch',
      'The Spotify response did not match this sign-in attempt, so it was rejected.',
    )
  }

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: callback.code,
        redirect_uri: pending.redirectUri,
        code_verifier: pending.verifier,
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new MusicAuthError(
        'invalid_token',
        `Spotify rejected the token exchange (${response.status}). ${summarise(detail)}`,
      )
    }
    const json = (await response.json()) as TokenResponse
    if (!json.access_token) {
      throw new MusicAuthError('invalid_token', 'Spotify returned no access token.')
    }
    const tokens = toTokenSet(json)
    store.save(tokens, remember)
    return tokens
  } catch (error) {
    if (error instanceof MusicAuthError) throw error
    throw new MusicAuthError(
      'network',
      'Could not reach Spotify to finish sign-in. Check your connection and try again.',
    )
  } finally {
    clearPending()
    clearSpotifyCallbackUrl()
  }
}

export async function refreshSpotifyToken(
  clientId: string,
  remember: boolean,
): Promise<TokenSet> {
  if (refreshInFlight) return refreshInFlight
  const current = store.load()
  if (!current?.refreshToken) {
    throw new MusicAuthError(
      'expired_token',
      'The Spotify session expired. Reconnect Spotify to continue.',
    )
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: current.refreshToken ?? '',
        }),
      })
      if (!response.ok) {
        store.clear()
        throw new MusicAuthError(
          'expired_token',
          'The Spotify session expired or was revoked. Reconnect Spotify to continue.',
        )
      }
      const json = (await response.json()) as TokenResponse
      if (!json.access_token) {
        store.clear()
        throw new MusicAuthError(
          'invalid_token',
          'Spotify did not return a refreshed token. Reconnect to continue.',
        )
      }
      const tokens = toTokenSet(json, current.refreshToken)
      store.save(tokens, remember)
      return tokens
    } catch (error) {
      if (error instanceof MusicAuthError) throw error
      throw new MusicAuthError(
        'network',
        'Could not refresh the Spotify session. Check your connection.',
      )
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

export async function getSpotifyToken(
  clientId: string,
  remember: boolean,
): Promise<TokenSet> {
  const tokens = store.load()
  if (!tokens) {
    throw new MusicAuthError(
      'expired_token',
      'Spotify is not connected. Connect it from Connected Music.',
    )
  }
  if (!TokenStore.isExpiring(tokens, 90_000)) return tokens
  if (!tokens.refreshToken) {
    store.clear()
    throw new MusicAuthError(
      'expired_token',
      'The Spotify session expired. Reconnect Spotify to continue.',
    )
  }
  return refreshSpotifyToken(clientId, remember)
}

export function clearSpotifySession(): void {
  store.clear()
  clearPending()
  refreshInFlight = null
}

export function hasSpotifySession(): boolean {
  return Boolean(store.load())
}

function summarise(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error_description?: string
      error?: string
    }
    return parsed.error_description ?? parsed.error ?? ''
  } catch {
    return body.slice(0, 160)
  }
}
