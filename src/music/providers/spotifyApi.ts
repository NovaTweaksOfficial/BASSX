import { MusicAuthError, type MusicItem } from '../types'
import {
  getSpotifyToken,
  refreshSpotifyToken,
} from '../auth/spotifyAuth'

/**
 * Thin Spotify Web API client.
 *
 * Docs: https://developer.spotify.com/documentation/web-api
 * Auth: OAuth 2.0 Authorization Code + PKCE (public client, no secret).
 *
 * The client never caches tokens itself — `getSpotifyToken` owns storage and
 * refresh so a single refresh can be shared by every in-flight request.
 */

const API_BASE = 'https://api.spotify.com/v1'

type SpotifyImage = {
  url: string
  width?: number | null
  height?: number | null
}

type SpotifyArtistRef = {
  name: string
  uri?: string
  external_urls?: { spotify?: string }
  images?: SpotifyImage[]
}

type SpotifyAlbumRef = {
  name: string
  images?: SpotifyImage[]
  uri?: string
  external_urls?: { spotify?: string }
  artists?: SpotifyArtistRef[]
  total_tracks?: number
}

type SpotifyTrack = {
  id: string | null
  name: string
  uri: string
  type?: string
  is_local?: boolean
  duration_ms?: number
  artists: SpotifyArtistRef[]
  album?: SpotifyAlbumRef
  external_urls?: { spotify?: string }
}

type SpotifyPlaylist = {
  id: string
  name: string
  uri: string
  description?: string | null
  images?: SpotifyImage[]
  external_urls?: { spotify?: string }
  owner?: { display_name?: string; id?: string }
  tracks?: { total?: number }
}

type SpotifyAlbum = {
  id: string
  name: string
  uri: string
  album_type?: string
  images?: SpotifyImage[]
  external_urls?: { spotify?: string }
  artists?: SpotifyArtistRef[]
  total_tracks?: number
}

type SpotifyArtist = {
  id: string
  name: string
  uri: string
  images?: SpotifyImage[]
  external_urls?: { spotify?: string }
  followers?: { total?: number }
  genres?: string[]
}

type SpotifyPaging<T> = { items: T[]; total?: number; next?: string | null }

type SpotifyPlaybackState = {
  is_playing: boolean
  progress_ms: number | null
  currently_playing_type?: string
  item?: SpotifyTrack | null
  context?: { type?: string; uri?: string; external_urls?: { spotify?: string } } | null
  device?: { id?: string | null; name?: string; type?: string; is_active?: boolean }
}

export type SpotifyProfile = {
  id: string
  display_name?: string | null
  email?: string
  product?: string
  country?: string
  images?: SpotifyImage[]
}

export type SpotifyRemotePlayback = {
  isPlaying: boolean
  position: number
  duration: number
  title: string
  artist: string
  album: string
  artworkUrl?: string
  itemUri?: string
  context?: string
  deviceName?: string
}

export class SpotifyApiError extends Error {
  readonly status: number
  readonly reason?: string

  constructor(status: number, message: string, reason?: string) {
    super(message)
    this.name = 'SpotifyApiError'
    this.status = status
    this.reason = reason
  }
}

function artwork(images?: SpotifyImage[]): string | undefined {
  if (!images?.length) return undefined
  return images.reduce((best, image) =>
    (image.width ?? image.height ?? 0) > (best.width ?? best.height ?? 0) ? image : best,
  ).url
}

function artistNames(artists?: SpotifyArtistRef[]): string {
  if (!artists?.length) return 'Unknown artist'
  return artists.map((artist) => artist.name).join(', ')
}

export function mapSpotifyTrack(track: SpotifyTrack): MusicItem {
  const album = track.album
  return {
    id: track.id ?? track.uri,
    service: 'spotify',
    kind: 'track',
    title: track.name,
    subtitle: artistNames(track.artists),
    artworkUrl: artwork(album?.images),
    uri: track.uri,
    externalUrl: track.external_urls?.spotify,
    context: album?.name,
    playable: !track.is_local && Boolean(track.uri) && Boolean(track.id),
  }
}

export function mapSpotifyPlaylist(playlist: SpotifyPlaylist): MusicItem {
  return {
    id: playlist.id,
    service: 'spotify',
    kind: 'playlist',
    title: playlist.name,
    subtitle: playlist.owner?.display_name
      ? `By ${playlist.owner.display_name}`
      : 'Your playlist',
    artworkUrl: artwork(playlist.images),
    uri: playlist.uri,
    externalUrl: playlist.external_urls?.spotify,
    trackCount: playlist.tracks?.total,
    owner: playlist.owner?.display_name,
    playable: true,
  }
}

export function mapSpotifyAlbum(album: SpotifyAlbum): MusicItem {
  return {
    id: album.id,
    service: 'spotify',
    kind: 'album',
    title: album.name,
    subtitle: artistNames(album.artists),
    artworkUrl: artwork(album.images),
    uri: album.uri,
    externalUrl: album.external_urls?.spotify,
    trackCount: album.total_tracks,
    playable: true,
  }
}

export function mapSpotifyArtist(artist: SpotifyArtist): MusicItem {
  return {
    id: artist.id,
    service: 'spotify',
    kind: 'artist',
    title: artist.name,
    subtitle: artist.genres?.slice(0, 2).join(' · ') || 'Artist',
    artworkUrl: artwork(artist.images),
    uri: artist.uri,
    externalUrl: artist.external_urls?.spotify,
    playable: true,
  }
}

type RequestOptions = {
  method?: 'GET' | 'PUT' | 'POST' | 'DELETE'
  body?: unknown
}

export class SpotifyClient {
  constructor(
    private readonly clientId: string,
    private readonly remember: boolean,
  ) {}

  private async request<T>(
    path: string,
    options: RequestOptions = {},
    retry = true,
  ): Promise<T> {
    const tokens = await getSpotifyToken(this.clientId, this.remember)
    const headers = new Headers({ Authorization: `Bearer ${tokens.accessToken}` })
    let body: string | undefined
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }

    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body,
      })
    } catch {
      throw new SpotifyApiError(
        0,
        'Could not reach Spotify. Check your connection and try again.',
      )
    }

    if (response.status === 401 && retry) {
      // Access token was revoked or expired early — refresh once, then retry.
      await refreshSpotifyToken(this.clientId, this.remember)
      return this.request<T>(path, options, false)
    }

    if (response.status === 204) return undefined as T

    if (!response.ok) {
      let detail = ''
      let reason: string | undefined
      try {
        const parsed = (await response.json()) as {
          error?: { message?: string; reason?: string } | string
        }
        if (typeof parsed.error === 'string') detail = parsed.error
        else {
          detail = parsed.error?.message ?? ''
          reason = parsed.error?.reason
        }
      } catch {
        /* response had no JSON body */
      }

      if (response.status === 401) {
        throw new MusicAuthError(
          'expired_token',
          'The Spotify session expired or was revoked. Reconnect Spotify to continue.',
        )
      }
      if (
        (response.status === 403 || response.status === 404) &&
        reason === 'NO_ACTIVE_DEVICE'
      ) {
        throw new MusicAuthError(
          'no_active_device',
          'Spotify has no active playback device. Open Spotify on a device, or enable in-app playback on a Premium account.',
        )
      }
      if (response.status === 403 && reason === 'PREMIUM_REQUIRED') {
        throw new MusicAuthError(
          'unsupported',
          'Spotify Premium is required to control playback. Library browsing still works.',
        )
      }
      throw new SpotifyApiError(
        response.status,
        detail || `Spotify returned HTTP ${response.status}.`,
        reason,
      )
    }

    const text = await response.text()
    if (!text) return undefined as T
    return JSON.parse(text) as T
  }

  async me(): Promise<SpotifyProfile> {
    return this.request<SpotifyProfile>('/me')
  }

  async recentlyPlayed(): Promise<MusicItem[]> {
    const data = await this.request<{
      items: Array<{ track: SpotifyTrack | null }>
    }>('/me/player/recently-played?limit=30')

    const seen = new Set<string>()
    const items: MusicItem[] = []
    for (const entry of data.items ?? []) {
      if (!entry.track || entry.track.type === 'episode') continue
      const key = entry.track.id ?? entry.track.uri
      if (seen.has(key)) continue
      seen.add(key)
      items.push(mapSpotifyTrack(entry.track))
    }
    return items
  }

  async playlists(): Promise<MusicItem[]> {
    const data = await this.request<SpotifyPaging<SpotifyPlaylist | null>>(
      '/me/playlists?limit=50',
    )
    return (data.items ?? [])
      .filter((playlist): playlist is SpotifyPlaylist => Boolean(playlist))
      .map(mapSpotifyPlaylist)
  }

  async albums(): Promise<MusicItem[]> {
    const data = await this.request<
      SpotifyPaging<{ album: SpotifyAlbum | null } | null>
    >('/me/albums?limit=50')
    return (data.items ?? [])
      .filter(
        (entry): entry is { album: SpotifyAlbum } =>
          Boolean(entry && entry.album),
      )
      .map((entry) => mapSpotifyAlbum(entry.album))
  }

  async tracks(): Promise<MusicItem[]> {
    const data = await this.request<
      SpotifyPaging<{ track: SpotifyTrack | null } | null>
    >('/me/tracks?limit=50')
    return (data.items ?? [])
      .filter(
        (entry): entry is { track: SpotifyTrack } =>
          Boolean(entry && entry.track),
      )
      .map((entry) => mapSpotifyTrack(entry.track))
  }

  async artists(): Promise<MusicItem[]> {
    const data = await this.request<{
      artists: SpotifyPaging<SpotifyArtist>
    }>('/me/following?type=artist&limit=50')
    return (data.artists?.items ?? []).map(mapSpotifyArtist)
  }

  async playback(): Promise<SpotifyRemotePlayback | null> {
    const state = await this.request<SpotifyPlaybackState | null>('/me/player')
    if (!state || !state.item) return null
    const track = state.item
    const contextLabel =
      state.context?.type && state.context.type !== 'artist'
        ? state.context.type.charAt(0).toUpperCase() + state.context.type.slice(1)
        : undefined
    return {
      isPlaying: Boolean(state.is_playing),
      position: state.progress_ms ?? 0,
      duration: track.duration_ms ?? 0,
      title: track.name,
      artist: artistNames(track.artists),
      album: track.album?.name ?? contextLabel ?? 'Spotify',
      artworkUrl: artwork(track.album?.images),
      itemUri: track.uri,
      context: contextLabel,
      deviceName: state.device?.name,
    }
  }

  async play(options: {
    uri?: string
    uris?: string[]
    contextUri?: string
    deviceId?: string
    positionMs?: number
  }): Promise<void> {
    const body: Record<string, unknown> = {}
    if (options.uris?.length) body.uris = options.uris
    else if (options.contextUri) body.context_uri = options.contextUri
    else if (options.uri) body.uris = [options.uri]
    if (typeof options.positionMs === 'number' && options.positionMs > 0) {
      body.position_ms = Math.floor(options.positionMs)
    }
    const query = options.deviceId
      ? `?device_id=${encodeURIComponent(options.deviceId)}`
      : ''
    await this.request<void>(`/me/player/play${query}`, {
      method: 'PUT',
      body,
    })
  }

  async pause(): Promise<void> {
    await this.request<void>('/me/player/pause', { method: 'PUT' })
  }

  async resume(): Promise<void> {
    await this.request<void>('/me/player/play', { method: 'PUT' })
  }

  async next(): Promise<void> {
    await this.request<void>('/me/player/next', { method: 'POST' })
  }

  async previous(): Promise<void> {
    await this.request<void>('/me/player/previous', { method: 'POST' })
  }

  async seek(positionMs: number): Promise<void> {
    await this.request<void>(
      `/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`,
      { method: 'PUT' },
    )
  }

  async transfer(deviceId: string, play = false): Promise<void> {
    await this.request<void>('/me/player', {
      method: 'PUT',
      body: { device_ids: [deviceId], play },
    })
  }

  async setShuffle(state: boolean): Promise<void> {
    await this.request<void>(`/me/player/shuffle?state=${state}`, {
      method: 'PUT',
    })
  }
}
