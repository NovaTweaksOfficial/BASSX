/**
 * Spotify Web Playback SDK wrapper.
 *
 * Docs: https://developer.spotify.com/documentation/web-playback-sdk
 *
 * The SDK creates a Spotify Connect device inside the browser. It requires
 * Spotify Premium (mobile-only Premium plans are excluded by Spotify) and a
 * browser with Encrypted Media Extensions. When it is unavailable we do not
 * fake a device — the caller falls back to the Web API remote-device flow.
 */

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js'

export type SpotifySdkTrack = {
  uri: string
  id: string | null
  name: string
  duration_ms: number
  artists: Array<{ name: string; uri?: string }>
  album: {
    name: string
    uri?: string
    images: Array<{ url: string; width?: number; height?: number }>
  }
}

export type SpotifySdkPlaybackState = {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: SpotifySdkTrack
    previous_tracks: SpotifySdkTrack[]
  }
  context?: {
    uri?: string
    metadata?: Record<string, string>
  }
}

export type SpotifyPlayerCallbacks = {
  /** Must resolve to a fresh access token; called by the SDK when needed. */
  getToken: () => Promise<string | null>
  onReady: (deviceId: string) => void
  onNotReady: (deviceId: string) => void
  onState: (state: SpotifySdkPlaybackState | null) => void
  onError: (code: string, message: string) => void
}

type SdkListener = (payload: unknown) => void

interface SpotifySdkPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, listener: SdkListener) => boolean
  removeListener: (event: string, listener: SdkListener) => boolean
  getCurrentState: () => Promise<SpotifySdkPlaybackState | null>
  togglePlay: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  nextTrack: (callback?: () => void) => Promise<void> | void
  previousTrack: (callback?: () => void) => Promise<void> | void
  seek: (positionMs: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string
        getOAuthToken: (callback: (token: string) => void) => void
        volume?: number
        enableMediaSession?: boolean
      }) => SpotifySdkPlayer
    }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

let sdkPromise: Promise<void> | null = null

export function loadSpotifySdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Spotify playback requires a browser.'))
  }
  if (window.Spotify) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existingReady = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      existingReady?.()
      resolve()
    }

    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onerror = () => {
      sdkPromise = null
      reject(
        new Error(
          'The Spotify playback SDK could not load. A network blocker or content policy may be blocking sdk.scdn.co.',
        ),
      )
    }
    document.head.appendChild(script)
  })

  return sdkPromise
}

export class SpotifyWebPlayer {
  private player: SpotifySdkPlayer | null = null
  private deviceId: string | null = null
  private readyTimer: number | null = null
  private readyResolve: (() => void) | null = null
  private readyReject: ((error: Error) => void) | null = null
  private readonly listeners: Array<[string, SdkListener]> = []

  constructor(private readonly callbacks: SpotifyPlayerCallbacks) {}

  get id(): string | null {
    return this.deviceId
  }

  async connect(): Promise<void> {
    if (this.player) return
    await loadSpotifySdk()
    const Spotify = window.Spotify
    if (!Spotify) {
      throw new Error('The Spotify playback SDK is not available in this browser.')
    }

    const ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
      this.readyTimer = window.setTimeout(() => {
        reject(new Error('Spotify did not initialise its player in time.'))
      }, 15_000)
    })

    const player = new Spotify.Player({
      name: 'BASSX',
      volume: 0.8,
      getOAuthToken: (callback) => {
        this.callbacks
          .getToken()
          .then((token) => {
            if (token) callback(token)
            else this.callbacks.onError('authentication_error', 'Spotify token unavailable.')
          })
          .catch(() => {
            this.callbacks.onError('authentication_error', 'Spotify token unavailable.')
          })
      },
    })

    const add = (event: string, listener: SdkListener) => {
      player.addListener(event, listener)
      this.listeners.push([event, listener])
    }

    add('ready', (payload) => {
      const { device_id } = payload as { device_id: string }
      this.deviceId = device_id
      this.settleReady()
      this.callbacks.onReady(device_id)
    })

    add('not_ready', (payload) => {
      const { device_id } = payload as { device_id: string }
      this.deviceId = null
      this.callbacks.onNotReady(device_id)
    })

    add('player_state_changed', (payload) => {
      this.callbacks.onState((payload as SpotifySdkPlaybackState | null) ?? null)
    })

    add('initialization_error', (payload) => {
      const message = (payload as { message?: string })?.message ?? 'Player failed to initialise.'
      this.failReady(message)
      this.callbacks.onError('initialization_error', message)
    })

    add('authentication_error', (payload) => {
      const message = (payload as { message?: string })?.message ?? 'Spotify authentication failed.'
      this.failReady(message)
      this.callbacks.onError('authentication_error', message)
    })

    add('account_error', (payload) => {
      const message =
        (payload as { message?: string })?.message ??
        'Spotify Premium is required for in-app playback.'
      this.failReady(message)
      this.callbacks.onError('account_error', message)
    })

    add('playback_error', (payload) => {
      const message = (payload as { message?: string })?.message ?? 'Spotify playback error.'
      this.callbacks.onError('playback_error', message)
    })

    this.player = player
    const connected = await player.connect()
    if (!connected) {
      this.disconnect()
      throw new Error('Spotify rejected the browser player connection.')
    }
    await ready
  }

  private settleReady(): void {
    if (this.readyTimer != null) {
      window.clearTimeout(this.readyTimer)
      this.readyTimer = null
    }
    this.readyResolve?.()
    this.readyResolve = null
    this.readyReject = null
  }

  private failReady(message: string): void {
    if (this.readyTimer != null) {
      window.clearTimeout(this.readyTimer)
      this.readyTimer = null
    }
    this.readyReject?.(new Error(message))
    this.readyResolve = null
    this.readyReject = null
  }

  async getState(): Promise<SpotifySdkPlaybackState | null> {
    if (!this.player) return null
    try {
      return await this.player.getCurrentState()
    } catch {
      return null
    }
  }

  async togglePlay(): Promise<void> {
    await this.player?.togglePlay()
  }

  async pause(): Promise<void> {
    await this.player?.pause()
  }

  async resume(): Promise<void> {
    await this.player?.resume()
  }

  async next(): Promise<void> {
    await this.player?.nextTrack()
  }

  async previous(): Promise<void> {
    await this.player?.previousTrack()
  }

  async seek(positionMs: number): Promise<void> {
    await this.player?.seek(Math.max(0, Math.round(positionMs)))
  }

  disconnect(): void {
    if (this.readyTimer != null) {
      window.clearTimeout(this.readyTimer)
      this.readyTimer = null
    }
    this.readyResolve = null
    this.readyReject = null
    const player = this.player
    if (player) {
      for (const [event, listener] of this.listeners) {
        try {
          player.removeListener(event, listener)
        } catch {
          /* listener may already be gone */
        }
      }
      try {
        player.disconnect()
      } catch {
        /* noop */
      }
    }
    this.listeners.length = 0
    this.player = null
    this.deviceId = null
  }
}
