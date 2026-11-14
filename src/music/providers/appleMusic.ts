import type { MusicItem } from '../types'

/**
 * Apple MusicKit JS adapter.
 *
 * Docs: https://developer.apple.com/documentation/musickitjs
 * MusicKit requires a developer token signed with an Apple private key. That
 * key must stay on a server, so BASSX only ever accepts a short-lived token
 * from a token endpoint (or one pasted by the user for the current session).
 *
 * Playback runs through Apple's protected media pipeline. The resulting audio
 * is intentionally not connected to the BASSX Web Audio graph.
 */

const MUSICKIT_URL = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js'

type AppleArtwork = {
  url?: string
  width?: number
  height?: number
  bgColor?: string
}

type ApplePlayParams = {
  id?: string
  catalogId?: string
  kind?: string
  isLibrary?: boolean
}

type AppleAttributes = {
  name?: string
  artistName?: string
  albumName?: string
  curatorName?: string
  artwork?: AppleArtwork
  durationInMillis?: number
  trackCount?: number
  playParams?: ApplePlayParams
  url?: string
}

export type AppleResource = {
  id: string
  type: string
  attributes?: AppleAttributes
  relationships?: Record<string, { data?: AppleResource[] }>
}

type AppleCollection = {
  data?: AppleResource[]
  next?: string
}

type AppleQuery = { limit?: number; offset?: number }

export type MusicKitInstance = {
  isAuthorized: boolean
  developerToken?: string
  authorize: () => Promise<string>
  unauthorize: () => Promise<void>
  api: {
    library: {
      playlists: (query?: AppleQuery) => Promise<AppleCollection>
      albums: (query?: AppleQuery) => Promise<AppleCollection>
      songs: (query?: AppleQuery) => Promise<AppleCollection>
      artists: (query?: AppleQuery) => Promise<AppleCollection>
    }
    recentPlayed: (query?: AppleQuery) => Promise<AppleCollection>
    historyHeavyRotation: (query?: AppleQuery) => Promise<AppleCollection>
  }
  setQueue: (options: Record<string, unknown>) => Promise<unknown>
  play: () => Promise<void>
  pause: () => void
  stop: () => void
  skipToNextItem: () => Promise<void>
  skipToPreviousItem: () => Promise<void>
  seekToTime: (seconds: number) => Promise<void>
  currentPlaybackTime: number
  currentPlaybackDuration: number
  playbackState: number
  nowPlayingItem: AppleResource | null
  addEventListener: (name: string, listener: (event: unknown) => void) => void
  removeEventListener: (name: string, listener: (event: unknown) => void) => void
}

type MusicKitNamespace = {
  configure: (config: {
    developerToken: string
    app: { name: string; build: string }
  }) => MusicKitInstance | Promise<MusicKitInstance>
  getInstance: () => MusicKitInstance
}

declare global {
  interface Window {
    MusicKit?: MusicKitNamespace
  }
}

export const APPLE_PLAYBACK = {
  none: 0,
  loading: 1,
  playing: 2,
  paused: 3,
  stopped: 4,
  ended: 5,
  seeking: 6,
  waiting: 7,
  stalled: 8,
  completed: 9,
} as const

let musicKitPromise: Promise<void> | null = null

export function loadMusicKit(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Apple Music requires a browser.'))
  }
  if (window.MusicKit) return Promise.resolve()
  if (musicKitPromise) return musicKitPromise

  musicKitPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = MUSICKIT_URL
    script.async = true
    script.onload = () => {
      if (window.MusicKit) resolve()
      else reject(new Error('MusicKit loaded but did not register itself.'))
    }
    script.onerror = () => {
      musicKitPromise = null
      reject(
        new Error(
          'MusicKit could not load from Apple’s CDN. A network blocker may be preventing js-cdn.music.apple.com.',
        ),
      )
    }
    document.head.appendChild(script)
  })

  return musicKitPromise
}

export async function configureMusicKit(
  developerToken: string,
  appName = 'BASSX',
  build = '1.1.0',
): Promise<MusicKitInstance> {
  await loadMusicKit()
  const MusicKit = window.MusicKit
  if (!MusicKit) throw new Error('MusicKit is not available in this browser.')

  // Reuse the configured instance if one exists; MusicKit does not support
  // calling configure twice with a different token.
  try {
    const existing = MusicKit.getInstance()
    if (existing) {
      try {
        existing.developerToken = developerToken
      } catch {
        /* read-only on some MusicKit builds */
      }
      return existing
    }
  } catch {
    /* not configured yet */
  }

  const instance = await Promise.resolve(
    MusicKit.configure({
      developerToken,
      app: { name: appName, build },
    }),
  )
  return instance
}

function artworkUrl(artwork?: AppleArtwork, size = 600): string | undefined {
  if (!artwork?.url) return undefined
  return artwork.url
    .replace('{w}', String(size))
    .replace('{h}', String(size))
    .replace('{f}', 'jpg')
}

function resourceKind(type: string): MusicItem['kind'] | null {
  switch (type) {
    case 'songs':
    case 'music-videos':
      return 'track'
    case 'albums':
      return 'album'
    case 'playlists':
      return 'playlist'
    case 'artists':
      return 'artist'
    default:
      return null
  }
}

export function mapAppleResource(resource: AppleResource): MusicItem | null {
  const kind = resourceKind(resource.type)
  const attributes = resource.attributes
  if (!kind || !attributes?.name) return null

  const id = attributes.playParams?.id ?? resource.id
  const subtitle =
    kind === 'track'
      ? [attributes.artistName, attributes.albumName].filter(Boolean).join(' · ') ||
        'Apple Music'
      : kind === 'album'
        ? attributes.artistName ?? 'Album'
        : kind === 'playlist'
          ? attributes.curatorName ?? 'Apple Music playlist'
          : 'Artist'

  return {
    id,
    service: 'appleMusic',
    kind,
    title: attributes.name ?? 'Apple Music',
    subtitle,
    artworkUrl: artworkUrl(attributes.artwork),
    externalUrl: attributes.url,
    trackCount: attributes.trackCount,
    context: kind === 'track' ? attributes.albumName : undefined,
    playable: kind !== 'artist',
  }
}

function mapCollection(collection: AppleCollection | undefined): MusicItem[] {
  const items: MusicItem[] = []
  const seen = new Set<string>()
  for (const resource of collection?.data ?? []) {
    const mapped = mapAppleResource(resource)
    if (!mapped) continue
    const key = `${mapped.kind}:${mapped.id}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(mapped)
  }
  return items
}

export const appleLibrary = {
  async recentlyPlayed(music: MusicKitInstance): Promise<MusicItem[]> {
    const recent = await music.api.recentPlayed({ limit: 30 })
    const items = mapCollection(recent)
    if (items.length) return items
    // Some accounts have no recent-played history; heavy rotation is the
    // closest official "favourites" signal.
    return mapCollection(await music.api.historyHeavyRotation({ limit: 30 }))
  },
  async playlists(music: MusicKitInstance): Promise<MusicItem[]> {
    return mapCollection(await music.api.library.playlists({ limit: 50 }))
  },
  async albums(music: MusicKitInstance): Promise<MusicItem[]> {
    return mapCollection(await music.api.library.albums({ limit: 50 }))
  },
  async tracks(music: MusicKitInstance): Promise<MusicItem[]> {
    return mapCollection(await music.api.library.songs({ limit: 100 }))
  },
  async artists(music: MusicKitInstance): Promise<MusicItem[]> {
    return mapCollection(await music.api.library.artists({ limit: 50 }))
  },
}

export async function playAppleItem(
  music: MusicKitInstance,
  item: MusicItem,
): Promise<void> {
  if (!item.playable) {
    throw new Error('Apple Music does not expose playback for this item type.')
  }
  const key =
    item.kind === 'track' ? 'song' : item.kind === 'album' ? 'album' : 'playlist'
  await music.setQueue({ [key]: item.id })
  await music.play()
}

export function appleNowPlaying(music: MusicKitInstance): {
  title: string
  artist: string
  album: string
  artworkUrl?: string
  isPlaying: boolean
  position: number
  duration: number
  itemUri?: string
} | null {
  const item = music.nowPlayingItem
  if (!item || !item.attributes?.name) return null
  const attributes = item.attributes
  const state = music.playbackState
  const playing =
    state === APPLE_PLAYBACK.playing ||
    state === APPLE_PLAYBACK.loading ||
    state === APPLE_PLAYBACK.seeking ||
    state === APPLE_PLAYBACK.waiting ||
    state === APPLE_PLAYBACK.stalled

  return {
    title: attributes.name ?? 'Apple Music',
    artist: attributes.artistName ?? 'Apple Music',
    album: attributes.albumName ?? 'Apple Music',
    artworkUrl: artworkUrl(attributes.artwork),
    isPlaying: playing,
    position: (music.currentPlaybackTime || 0) * 1000,
    duration:
      attributes.durationInMillis ??
      Math.round((music.currentPlaybackDuration || 0) * 1000),
    itemUri: attributes.playParams?.id ?? item.id,
  }
}
