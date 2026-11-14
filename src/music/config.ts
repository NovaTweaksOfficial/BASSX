/**
 * Non-secret integration configuration.
 *
 * Spotify's Client ID is public by design. Apple's developer token IS a bearer
 * credential, so it is kept in sessionStorage only and never written to the
 * longer-lived config record.
 */

const CONFIG_KEY = 'bassx.music.config.v1'
const APPLE_TOKEN_KEY = 'bassx.music.apple.devtoken'

export type MusicConfig = {
  spotifyClientId: string
  appleTokenEndpoint: string
  /** Persist Spotify tokens across browser restarts. */
  rememberSpotify: boolean
}

export const DEFAULT_CONFIG: MusicConfig = {
  spotifyClientId: '',
  appleTokenEndpoint: '',
  rememberSpotify: false,
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function session(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export function loadConfig(): MusicConfig {
  try {
    const raw = storage()?.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw) as Partial<MusicConfig>
    return {
      spotifyClientId:
        typeof parsed.spotifyClientId === 'string'
          ? parsed.spotifyClientId.trim()
          : '',
      appleTokenEndpoint:
        typeof parsed.appleTokenEndpoint === 'string'
          ? parsed.appleTokenEndpoint.trim()
          : '',
      rememberSpotify: Boolean(parsed.rememberSpotify),
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: MusicConfig): void {
  try {
    storage()?.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    /* noop */
  }
}

export function loadAppleDeveloperToken(): string {
  try {
    return session()?.getItem(APPLE_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveAppleDeveloperToken(token: string): void {
  try {
    if (token) session()?.setItem(APPLE_TOKEN_KEY, token)
    else session()?.removeItem(APPLE_TOKEN_KEY)
  } catch {
    /* noop */
  }
}

/**
 * The OAuth redirect URI must match the Spotify dashboard exactly.
 * Using the app's real route keeps it stable across Pages deployments.
 */
export function getRedirectUri(): string {
  if (typeof window === 'undefined') return ''
  const base = import.meta.env.BASE_URL || '/'
  const path = `${base.replace(/\/+$/, '')}/music`
  return `${window.location.origin}${path || '/music'}`
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return true
    // Plain HTTP is only tolerated for loopback development servers; a hosted
    // HTTPS build would block it as mixed content anyway.
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]')
    )
  } catch {
    return false
  }
}
