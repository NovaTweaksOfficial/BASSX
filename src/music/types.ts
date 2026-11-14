/**
 * Shared types for the BASSX connected-music layer.
 *
 * The guiding rule across these types: capability flags describe what a
 * provider actually permits. `dsp` is never true for a protected streaming
 * service, because BASSX must not claim to process audio it cannot legally or
 * technically access.
 */

export type ServiceId =
  | 'spotify'
  | 'appleMusic'
  | 'soundcloud'
  | 'youtubeMusic'
  | 'tidal'
  | 'deezer'
  | 'amazonMusic'

/** Providers BASSX can actually authorize and play from. */
export type ConnectableServiceId = 'spotify' | 'appleMusic'

export type ServiceAvailability = 'available' | 'requires-setup' | 'unavailable'

export type CapabilityLevel = 'full' | 'limited' | 'none'

export type CapabilityName =
  | 'authorize'
  | 'library'
  | 'metadata'
  | 'playback'
  | 'search'
  | 'dsp'

export type Capabilities = Record<CapabilityName, CapabilityLevel>

export type ServiceDefinition = {
  id: ServiceId
  name: string
  shortName: string
  tagline: string
  description: string
  /** Brand colour used for the logo tile and accents. */
  brand: string
  brandInk: string
  docsUrl: string
  availability: ServiceAvailability
  /** One-sentence explanation of the state above. */
  availabilityReason: string
  /** Short, human-readable description of the auth flow. */
  authModel: string
  /** Everything the user must have before connecting. */
  requirements: string[]
  capabilities: Capabilities
  /** Honest, provider-specific limitations shown in the UI. */
  limitations: string[]
  /** Which setup screen (if any) this provider needs. */
  setup: 'spotify-client' | 'apple-token' | null
  /** Providers we researched but cannot support in a static web app. */
  secondary?: boolean
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reauth'
  | 'error'

export type PlaybackMode = 'device' | 'remote' | 'none'

export type Connection = {
  service: ServiceId
  status: ConnectionStatus
  accountName?: string
  accountId?: string
  connectedAt?: number
  error?: string
  playbackMode?: PlaybackMode
}

export type MusicItemKind = 'track' | 'album' | 'playlist' | 'artist'

export type MusicItem = {
  /** Provider-scoped id. Unique only within `service`. */
  id: string
  service: ServiceId
  kind: MusicItemKind
  title: string
  subtitle?: string
  artworkUrl?: string
  /** Provider URI used for playback (spotify:track:…, apple id, etc.). */
  uri?: string
  externalUrl?: string
  trackCount?: number
  owner?: string
  /** False when the provider reports the item as unplayable. */
  playable?: boolean
  /** Optional context label, e.g. the album a track belongs to. */
  context?: string
}

export type LibrarySection =
  | 'recent'
  | 'playlists'
  | 'albums'
  | 'tracks'
  | 'artists'

export const LIBRARY_SECTIONS: Array<{
  id: LibrarySection
  label: string
  emptyLabel: string
}> = [
  { id: 'recent', label: 'Recently played', emptyLabel: 'No recent plays yet' },
  { id: 'playlists', label: 'Playlists', emptyLabel: 'No playlists found' },
  { id: 'albums', label: 'Albums', emptyLabel: 'No saved albums' },
  { id: 'tracks', label: 'Favorites', emptyLabel: 'No favorite tracks' },
  { id: 'artists', label: 'Artists', emptyLabel: 'No followed artists' },
]

export type LibraryState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: MusicItem[]
  error?: string
  updatedAt?: number
}

export type ServiceLibraries = Record<LibrarySection, LibraryState>

export function emptyLibraries(): ServiceLibraries {
  return {
    recent: { status: 'idle', items: [] },
    playlists: { status: 'idle', items: [] },
    albums: { status: 'idle', items: [] },
    tracks: { status: 'idle', items: [] },
    artists: { status: 'idle', items: [] },
  }
}

export type ProviderNowPlaying = {
  service: ServiceId
  title: string
  artist: string
  album: string
  artworkUrl?: string
  isPlaying: boolean
  position: number
  duration: number
  canSeek: boolean
  /** Context (playlist / album) if the provider reports one. */
  context?: string
  itemUri?: string
  /** True whenever the audio is a protected provider stream. */
  protectedAudio: boolean
  playbackMode: PlaybackMode
}

export type PlaybackOrigin = 'local' | ServiceId

export type UnifiedNowPlaying = {
  origin: PlaybackOrigin
  service: ServiceId | null
  serviceName: string
  title: string
  artist: string
  album: string
  artworkUrl?: string
  isPlaying: boolean
  isLoading: boolean
  position: number
  duration: number
  canSeek: boolean
  /** BASSX DSP is only ever applied to local, unencrypted audio. */
  dspActive: boolean
  context?: string
}

export type AuthErrorCode =
  | 'cancelled'
  | 'state_mismatch'
  | 'missing_config'
  | 'invalid_token'
  | 'expired_token'
  | 'network'
  | 'provider'
  | 'unsupported'
  | 'no_active_device'

export class MusicAuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.name = 'MusicAuthError'
    this.code = code
  }
}
