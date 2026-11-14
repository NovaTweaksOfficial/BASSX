/**
 * PKCE helpers (RFC 7636) and OAuth state generation.
 *
 * Everything here runs in the browser using Web Crypto. No secret is involved:
 * that is exactly why PKCE exists.
 */

const VERIFIER_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

export function randomString(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += VERIFIER_CHARS[bytes[i] % VERIFIER_CHARS.length]
  }
  return out
}

export function base64UrlEncode(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function sha256(value: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(value)
  return crypto.subtle.digest('SHA-256', data)
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  return base64UrlEncode(await sha256(verifier))
}

export function createState(): string {
  return randomString(43)
}

export function createVerifier(): string {
  return randomString(96)
}

/** Decode a JWT payload without verifying it (verification is the provider's job). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function jwtExpiresAt(token: string): number | null {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  return typeof exp === 'number' ? exp * 1000 : null
}
