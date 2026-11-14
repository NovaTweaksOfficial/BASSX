import { useMemo } from 'react'
import { usePlayer } from '../player/PlayerProvider'
import { useMusic } from './MusicProvider'
import { getService } from './providers/registry'
import type { UnifiedNowPlaying } from './types'

/**
 * Merges the local BASSX deck and the connected providers into a single
 * transport. Only one source is ever active at a time: starting provider
 * playback pauses local audio (and vice versa) inside MusicProvider.
 *
 * Positions and durations are exposed in seconds to match the local player.
 */
export type UnifiedPlayback = UnifiedNowPlaying & {
  hasTrack: boolean
  localActive: boolean
  providerActive: boolean
  canNext: boolean
  canPrevious: boolean
  switchToLocal: () => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
}

export function useUnifiedPlayback(): UnifiedPlayback {
  const local = usePlayer()
  const music = useMusic()

  return useMemo<UnifiedPlayback>(() => {
    const provider = music.nowPlaying
    const providerActive = Boolean(provider && music.activeService)

    const togglePlay = () => {
      if (providerActive) void music.toggleProvider()
      else void local.togglePlay()
    }
    const next = () => {
      if (providerActive) void music.providerNext()
      else local.next()
    }
    const previous = () => {
      if (providerActive) void music.providerPrevious()
      else local.previous()
    }
    const seek = (seconds: number) => {
      if (providerActive) void music.seekProvider(seconds * 1000)
      else local.seek(seconds)
    }
    const switchToLocal = () => {
      void (async () => {
        await music.stopProvider()
        await local.togglePlay()
      })()
    }

    if (providerActive && provider) {
      const service = getService(provider.service)
      const duration = provider.duration > 0 ? provider.duration / 1000 : 0
      const position = Math.min(provider.position / 1000, duration || Infinity)
      return {
        origin: provider.service,
        service: provider.service,
        serviceName: service?.name ?? 'Connected music',
        title: provider.title,
        artist: provider.artist,
        album: provider.album,
        artworkUrl: provider.artworkUrl,
        isPlaying: provider.isPlaying,
        isLoading: false,
        position,
        duration,
        canSeek: provider.canSeek && duration > 0,
        dspActive: false,
        context: provider.context,
        hasTrack: true,
        localActive: false,
        providerActive: true,
        canNext: true,
        canPrevious: true,
        switchToLocal,
        togglePlay,
        next,
        previous,
        seek,
      }
    }

    const track = local.currentTrack
    const duration = Number.isFinite(local.duration) ? local.duration : 0
    return {
      origin: 'local',
      service: null,
      serviceName: 'BASSX local',
      title: track?.title ?? 'Choose a track',
      artist: track?.artist ?? 'Local library',
      album: track?.album ?? 'BASSX',
      artworkUrl: track?.artworkUrl,
      isPlaying: local.isPlaying,
      isLoading: local.isLoading,
      position: local.time,
      duration,
      canSeek: duration > 0,
      dspActive: true,
      context: track?.isDemo ? 'Demo transmission' : undefined,
      hasTrack: Boolean(track),
      localActive: true,
      providerActive: false,
      canNext: local.tracks.length > 1,
      canPrevious: local.tracks.length > 1,
      switchToLocal: () => undefined,
      togglePlay,
      next,
      previous,
      seek,
    }
  }, [local, music])
}
