/**
 * Token storage.
 *
 * A static site has no server and therefore no secure secret store. The safest
 * practical design is:
 *   - keep access/refresh tokens in sessionStorage by default (cleared when the
 *     browser session ends),
 *   - only persist to localStorage when the user explicitly asks to be
 *     remembered,
 *   - never send tokens anywhere except the provider's own API,
 *   - never log them.
 *
 * A native build or a backend-for-frontend can swap this module for one backed
 * by the Keychain / Keystore without touching provider code.
 */

export type TokenSet = {
  accessToken: string
  refreshToken?: string
  /** Epoch milliseconds. */
  expiresAt: number
  tokenType?: string
  scope?: string
}

const SESSION_PREFIX = 'bassx.token.session.'
const LOCAL_PREFIX = 'bassx.token.local.'

function safeGet(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    /* private mode / quota — tokens simply won't persist */
  }
}

function safeRemove(storage: Storage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    /* noop */
  }
}

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function localStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export class TokenStore {
  constructor(private readonly namespace: string) {}

  save(tokens: TokenSet, remember = false): void {
    const payload = JSON.stringify(tokens)
    this.clear()
    if (remember) {
      safeSet(localStore(), LOCAL_PREFIX + this.namespace, payload)
    } else {
      safeSet(sessionStore(), SESSION_PREFIX + this.namespace, payload)
    }
  }

  load(): TokenSet | null {
    const raw =
      safeGet(sessionStore(), SESSION_PREFIX + this.namespace) ??
      safeGet(localStore(), LOCAL_PREFIX + this.namespace)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<TokenSet>
      if (
        typeof parsed.accessToken !== 'string' ||
        typeof parsed.expiresAt !== 'number'
      ) {
        return null
      }
      return {
        accessToken: parsed.accessToken,
        refreshToken:
          typeof parsed.refreshToken === 'string' ? parsed.refreshToken : undefined,
        expiresAt: parsed.expiresAt,
        tokenType:
          typeof parsed.tokenType === 'string' ? parsed.tokenType : 'Bearer',
        scope: typeof parsed.scope === 'string' ? parsed.scope : undefined,
      }
    } catch {
      return null
    }
  }

  clear(): void {
    safeRemove(sessionStore(), SESSION_PREFIX + this.namespace)
    safeRemove(localStore(), LOCAL_PREFIX + this.namespace)
  }

  /** True when the token is expired or will expire inside `skewMs`. */
  static isExpiring(tokens: TokenSet | null, skewMs = 60_000): boolean {
    if (!tokens) return true
    return tokens.expiresAt - skewMs <= Date.now()
  }
}
