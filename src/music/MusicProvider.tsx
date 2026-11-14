import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { APP_VERSION } from '../constants'
import { usePlayer } from '../player/PlayerProvider'
import { useToast } from '../ui/ToastProvider'
import {
  buildSpotifyAuthorizeUrl,
  clearSpotifySession,
  completeSpotifyAuth,
  getSpotifyToken,
  hasSpotifySession,
  readSpotifyCallback,
} from './auth/spotifyAuth'
import {
  inspectAppleToken,
  resolveAppleDeveloperToken,
  validatePastedAppleToken,
} from './auth/appleToken'
import {
  getRedirectUri,
  loadAppleDeveloperToken,
  loadConfig,
  saveConfig,
  type MusicConfig,
} from './config'
import {
  APPLE_PLAYBACK,
  appleLibrary,
  appleNowPlaying,
  configureMusicKit,
  playAppleItem,
  type MusicKitInstance,
} from './providers/appleMusic'
import { SpotifyClient, SpotifyApiError } from './providers/spotifyApi'
import {
  SpotifyWebPlayer,
  type SpotifySdkPlaybackState,
} from './providers/spotifyPlayer'
import {
  LIBRARY_SECTIONS,
  MusicAuthError,
  emptyLibraries,
  type ConnectableServiceId,
  type Connection,
  type LibrarySection,
  type MusicItem,
  type ProviderNowPlaying,
  type ServiceLibraries,
} from './types'

export type ConnectableService = ConnectableServiceId

export type SpotifySdkState = 'idle' | 'loading' | 'ready' | 'error'

type Connections = Record<ConnectableService, Connection>
type Libraries = Record<ConnectableService, ServiceLibraries>

type MusicContextValue = {
  config: MusicConfig
  updateConfig: (patch: Partial<MusicConfig>) => void
  connections: Connections
  libraries: Libraries
  busyService: ConnectableService | null
  sdkState: SpotifySdkState
  sdkMessage: string | null
  nowPlaying: ProviderNowPlaying | null
  activeService: ConnectableService | null
  connectSpotify: (clientIdOverride?: string) => Promise<void>
  connectAppleMusic: (configOverride?: MusicConfig) => Promise<void>
  disconnect: (service: ConnectableService) => Promise<void>
  refreshLibrary: (service: ConnectableService, section: LibrarySection) => Promise<void>
  refreshAll: (service: ConnectableService) => Promise<void>
  playItem: (service: ConnectableService, item: MusicItem) => Promise<void>
  toggleProvider: () => Promise<void>
  providerNext: () => Promise<void>
  providerPrevious: () => Promise<void>
  seekProvider: (positionMs: number) => Promise<void>
  stopProvider: () => Promise<void>
  validateAppleToken: (token: string) => string
  inspectAppleToken: (token: string) => { expiresAt: number | null; expired: boolean }
}

const MusicContext = createContext<MusicContextValue | null>(null)

const INITIAL_CONNECTIONS: Connections = {
  spotify: { service: 'spotify', status: 'disconnected', playbackMode: 'none' },
  appleMusic: { service: 'appleMusic', status: 'disconnected', playbackMode: 'none' },
}

function initialLibraries(): Libraries {
  return {
    spotify: emptyLibraries(),
    appleMusic: emptyLibraries(),
  }
}

function messageFor(error: unknown): string {
  if (error instanceof MusicAuthError) return error.message
  if (error instanceof SpotifyApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong. Please try again.'
}

function looksCancelled(error: unknown): boolean {
  const message = messageFor(error).toLowerCase()
  return message.includes('cancel') || message.includes('denied') || message.includes('close')
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const local = usePlayer()
  const { toast } = useToast()

  const [config, setConfig] = useState<MusicConfig>(() => loadConfig())
  const [connections, setConnections] = useState<Connections>(INITIAL_CONNECTIONS)
  const [libraries, setLibraries] = useState<Libraries>(initialLibraries)
  const [busyService, setBusyService] = useState<ConnectableService | null>(null)
  const [sdkState, setSdkState] = useState<SpotifySdkState>('idle')
  const [sdkMessage, setSdkMessage] = useState<string | null>(null)
  const [nowPlaying, setNowPlaying] = useState<ProviderNowPlaying | null>(null)
  const [activeService, setActiveService] = useState<ConnectableService | null>(null)

  const configRef = useRef(config)
  const connectionsRef = useRef(connections)
  const nowPlayingRef = useRef(nowPlaying)
  const activeServiceRef = useRef(activeService)
  const pauseLocalRef = useRef<() => void>(() => undefined)
  const bootstrapped = useRef(false)
  const spotifyPlayerRef = useRef<SpotifyWebPlayer | null>(null)
  const spotifySdkAttempted = useRef(false)
  const deviceIdRef = useRef<string | null>(null)
  const pollingSpotify = useRef(false)
  const appleRef = useRef<MusicKitInstance | null>(null)
  const appleListenersRef = useRef<{
    state: (event: unknown) => void
    item: (event: unknown) => void
  } | null>(null)

  configRef.current = config
  connectionsRef.current = connections
  nowPlayingRef.current = nowPlaying
  activeServiceRef.current = activeService
  pauseLocalRef.current = () => {
    const audio = local.audioRef.current
    if (audio && !audio.paused) audio.pause()
  }

  const spotifyClient = useMemo(
    () => new SpotifyClient(config.spotifyClientId, config.rememberSpotify),
    [config.spotifyClientId, config.rememberSpotify],
  )
  const spotifyClientRef = useRef(spotifyClient)
  spotifyClientRef.current = spotifyClient

  const updateConfig = useCallback((patch: Partial<MusicConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      saveConfig(next)
      return next
    })
  }, [])

  const patchConnection = useCallback(
    (service: ConnectableService, patch: Partial<Connection>) => {
      setConnections((prev) => ({
        ...prev,
        [service]: { ...prev[service], ...patch },
      }))
    },
    [],
  )

  const updateSection = useCallback(
    (
      service: ConnectableService,
      section: LibrarySection,
      patch: Partial<ServiceLibraries[LibrarySection]>,
    ) => {
      setLibraries((prev) => ({
        ...prev,
        [service]: {
          ...prev[service],
          [section]: { ...prev[service][section], ...patch },
        },
      }))
    },
    [],
  )

  const clearServiceLibraries = useCallback((service: ConnectableService) => {
    setLibraries((prev) => ({ ...prev, [service]: emptyLibraries() }))
  }, [])

  const handleAuthFailure = useCallback(
    (service: ConnectableService, error: unknown): boolean => {
      if (
        !(error instanceof MusicAuthError) ||
        (error.code !== 'expired_token' && error.code !== 'invalid_token')
      ) {
        return false
      }

      if (service === 'spotify') {
        clearSpotifySession()
        spotifySdkAttempted.current = false
        spotifyPlayerRef.current?.disconnect()
        spotifyPlayerRef.current = null
        deviceIdRef.current = null
        setSdkState('idle')
        setSdkMessage(null)
      } else {
        appleRef.current?.pause()
      }

      patchConnection(service, {
        status: 'reauth',
        error: error.message,
        playbackMode: 'none',
      })
      clearServiceLibraries(service)
      if (activeServiceRef.current === service) {
        setActiveService(null)
        setNowPlaying(null)
      }
      return true
    },
    [clearServiceLibraries, patchConnection],
  )

  const syncSpotifySdkState = useCallback((state: SpotifySdkPlaybackState) => {
    const track = state.track_window?.current_track
    if (!track) return
    setActiveService('spotify')
    setNowPlaying({
      service: 'spotify',
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(', ') || 'Spotify',
      album: track.album?.name ?? 'Spotify',
      artworkUrl: track.album?.images?.[0]?.url,
      isPlaying: !state.paused,
      position: state.position,
      duration: state.duration,
      canSeek: true,
      context: state.context?.metadata?.context_description,
      itemUri: track.uri,
      protectedAudio: true,
      playbackMode: 'device',
    })
    if (!state.paused) pauseLocalRef.current()
  }, [])

  const pollSpotify = useCallback(async () => {
    if (pollingSpotify.current) return
    if (document.visibilityState === 'hidden') return
    if (connectionsRef.current.spotify.status !== 'connected') return
    if (activeServiceRef.current === 'appleMusic') return

    pollingSpotify.current = true
    try {
      const player = spotifyPlayerRef.current
      if (player && activeServiceRef.current === 'spotify') {
        const state = await player.getState()
        if (state) {
          syncSpotifySdkState(state)
          return
        }
      }

      const playback = await spotifyClientRef.current.playback()
      if (!playback) {
        if (activeServiceRef.current === 'spotify') {
          setNowPlaying((prev) => (prev ? { ...prev, isPlaying: false } : null))
        }
        return
      }

      setActiveService('spotify')
      setNowPlaying({
        service: 'spotify',
        title: playback.title,
        artist: playback.artist,
        album: playback.album,
        artworkUrl: playback.artworkUrl,
        isPlaying: playback.isPlaying,
        position: playback.position,
        duration: playback.duration,
        canSeek: true,
        context: playback.context,
        itemUri: playback.itemUri,
        protectedAudio: true,
        playbackMode: 'remote',
      })
      if (playback.isPlaying) pauseLocalRef.current()
    } catch (error) {
      if (!handleAuthFailure('spotify', error)) {
        // Transient network errors should not tear down a working session.
        if (error instanceof SpotifyApiError && error.status === 0) return
      }
    } finally {
      pollingSpotify.current = false
    }
  }, [handleAuthFailure, syncSpotifySdkState])

  const refreshLibrary = useCallback(
    async (service: ConnectableService, section: LibrarySection) => {
      updateSection(service, section, { status: 'loading', error: undefined })
      try {
        let items: MusicItem[] = []
        if (service === 'spotify') {
          if (!hasSpotifySession()) {
            throw new MusicAuthError('unsupported', 'Spotify is not connected.')
          }
          switch (section) {
            case 'recent':
              items = await spotifyClientRef.current.recentlyPlayed()
              break
            case 'playlists':
              items = await spotifyClientRef.current.playlists()
              break
            case 'albums':
              items = await spotifyClientRef.current.albums()
              break
            case 'tracks':
              items = await spotifyClientRef.current.tracks()
              break
            case 'artists':
              items = await spotifyClientRef.current.artists()
              break
          }
        } else {
          const instance = appleRef.current
          if (!instance) {
            throw new MusicAuthError('unsupported', 'Apple Music is not configured.')
          }
          if (!instance.isAuthorized) {
            throw new MusicAuthError(
              'expired_token',
              'Apple Music authorization expired. Reconnect Apple Music.',
            )
          }
          switch (section) {
            case 'recent':
              items = await appleLibrary.recentlyPlayed(instance)
              break
            case 'playlists':
              items = await appleLibrary.playlists(instance)
              break
            case 'albums':
              items = await appleLibrary.albums(instance)
              break
            case 'tracks':
              items = await appleLibrary.tracks(instance)
              break
            case 'artists':
              items = await appleLibrary.artists(instance)
              break
          }
        }

        updateSection(service, section, {
          status: 'ready',
          items,
          error: undefined,
          updatedAt: Date.now(),
        })
      } catch (error) {
        if (handleAuthFailure(service, error)) return
        updateSection(service, section, {
          status: 'error',
          error: messageFor(error),
        })
      }
    },
    [handleAuthFailure, updateSection],
  )

  const refreshAll = useCallback(
    async (service: ConnectableService) => {
      await Promise.all(
        LIBRARY_SECTIONS.map((section) => refreshLibrary(service, section.id)),
      )
    },
    [refreshLibrary],
  )

  const ensureSpotifyPlayer = useCallback(async () => {
    if (spotifyPlayerRef.current || spotifySdkAttempted.current) return
    if (!hasSpotifySession()) return

    spotifySdkAttempted.current = true
    setSdkState('loading')
    setSdkMessage(null)

    const player = new SpotifyWebPlayer({
      getToken: async () => {
        try {
          const tokens = await getSpotifyToken(
            configRef.current.spotifyClientId,
            configRef.current.rememberSpotify,
          )
          return tokens.accessToken
        } catch {
          return null
        }
      },
      onReady: (deviceId) => {
        deviceIdRef.current = deviceId
        setSdkState('ready')
        setSdkMessage(null)
        patchConnection('spotify', { playbackMode: 'device' })
      },
      onNotReady: () => {
        deviceIdRef.current = null
        setSdkState('loading')
      },
      onState: (state) => {
        if (state) {
          syncSpotifySdkState(state)
        } else if (activeServiceRef.current === 'spotify') {
          setNowPlaying((prev) => (prev ? { ...prev, isPlaying: false } : null))
        }
      },
      onError: (code, message) => {
        setSdkMessage(message)
        if (
          code === 'account_error' ||
          code === 'authentication_error' ||
          code === 'initialization_error'
        ) {
          setSdkState('error')
        }
      },
    })

    spotifyPlayerRef.current = player
    try {
      await player.connect()
      setSdkState('ready')
      patchConnection('spotify', { playbackMode: 'device' })
    } catch (error) {
      player.disconnect()
      spotifyPlayerRef.current = null
      deviceIdRef.current = null
      setSdkState('error')
      setSdkMessage(messageFor(error))
      patchConnection('spotify', { playbackMode: 'remote' })
    }
  }, [patchConnection, syncSpotifySdkState])

  const finalizeSpotifyConnection = useCallback(async () => {
    const profile = await spotifyClientRef.current.me()
    const premium = profile.product === 'premium'
    patchConnection('spotify', {
      status: 'connected',
      accountName: profile.display_name || profile.id,
      accountId: profile.id,
      connectedAt: Date.now(),
      error: undefined,
      playbackMode: premium ? 'remote' : 'none',
    })
    if (premium) {
      void ensureSpotifyPlayer()
    } else {
      setSdkMessage(
        'Spotify Premium is required for in-app playback. Library browsing and remote-device control still work.',
      )
    }
    await refreshAll('spotify')
  }, [ensureSpotifyPlayer, patchConnection, refreshAll])

  const finishSpotifyRedirect = useCallback(async () => {
    patchConnection('spotify', { status: 'connecting', error: undefined })
    setBusyService('spotify')
    try {
      const clientId = configRef.current.spotifyClientId.trim()
      if (!clientId) {
        throw new MusicAuthError(
          'missing_config',
          'Add your Spotify Client ID, then connect again.',
        )
      }
      await completeSpotifyAuth(clientId, configRef.current.rememberSpotify)
      await finalizeSpotifyConnection()
      toast('Spotify connected', 'success')
    } catch (error) {
      const message = messageFor(error)
      patchConnection('spotify', {
        status: looksCancelled(error) ? 'disconnected' : 'error',
        error: message,
      })
      toast(message, 'warn')
    } finally {
      setBusyService(null)
    }
  }, [finalizeSpotifyConnection, patchConnection, toast])

  const connectSpotify = useCallback(async (clientIdOverride?: string) => {
    const clientId = (clientIdOverride ?? configRef.current.spotifyClientId).trim()
    if (!clientId) {
      const message = 'Add your Spotify Client ID in setup before connecting.'
      patchConnection('spotify', { status: 'error', error: message })
      toast(message, 'warn')
      return
    }
    setBusyService('spotify')
    patchConnection('spotify', { status: 'connecting', error: undefined })
    try {
      const url = await buildSpotifyAuthorizeUrl(clientId, getRedirectUri())
      window.location.assign(url)
    } catch (error) {
      setBusyService(null)
      const message = messageFor(error)
      patchConnection('spotify', { status: 'error', error: message })
      toast(message, 'warn')
    }
  }, [patchConnection, toast])

  const restoreSpotify = useCallback(async () => {
    const clientId = configRef.current.spotifyClientId.trim()
    if (!clientId || !hasSpotifySession()) return
    patchConnection('spotify', { status: 'connecting' })
    try {
      await finalizeSpotifyConnection()
    } catch (error) {
      if (!handleAuthFailure('spotify', error)) {
        patchConnection('spotify', {
          status: 'error',
          error: messageFor(error),
        })
      }
    }
  }, [finalizeSpotifyConnection, handleAuthFailure, patchConnection])

  const attachAppleListeners = useCallback(
    (instance: MusicKitInstance) => {
      if (appleListenersRef.current) return
      const state = () => syncApple(instance, false)
      const item = () => syncApple(instance, false)
      instance.addEventListener('playbackStateDidChange', state)
      instance.addEventListener('nowPlayingItemDidChange', item)
      appleListenersRef.current = { state, item }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const syncApple = useCallback(
    (instance: MusicKitInstance, force: boolean) => {
      const info = appleNowPlaying(instance)
      if (!info) {
        if (activeServiceRef.current === 'appleMusic') setNowPlaying(null)
        return
      }
      const isActive = activeServiceRef.current === 'appleMusic'
      if (!info.isPlaying && !isActive && !force) return
      setActiveService('appleMusic')
      setNowPlaying({
        service: 'appleMusic',
        ...info,
        canSeek: true,
        protectedAudio: true,
        playbackMode: 'device',
      })
      if (info.isPlaying) pauseLocalRef.current()
    },
    [],
  )

  const ensureApple = useCallback(
    async (configOverride?: MusicConfig): Promise<MusicKitInstance> => {
      if (appleRef.current) return appleRef.current
      const token = await resolveAppleDeveloperToken(
        configOverride ?? configRef.current,
      )
      const instance = await configureMusicKit(token, 'BASSX', APP_VERSION)
      appleRef.current = instance
      attachAppleListeners(instance)
      return instance
    },
    [attachAppleListeners],
  )

  const restoreApple = useCallback(async () => {
    if (!configRef.current.appleTokenEndpoint && !loadAppleDeveloperToken()) return
    try {
      const instance = await ensureApple()
      if (!instance.isAuthorized) return
      patchConnection('appleMusic', {
        status: 'connected',
        accountName: 'Apple Music',
        connectedAt: Date.now(),
        error: undefined,
        playbackMode: 'device',
      })
      void refreshAll('appleMusic')
    } catch (error) {
      if (error instanceof MusicAuthError && error.code === 'missing_config') return
      patchConnection('appleMusic', {
        status: 'error',
        error: messageFor(error),
      })
    }
  }, [ensureApple, patchConnection, refreshAll])

  const connectAppleMusic = useCallback(async (configOverride?: MusicConfig) => {
    if (busyService) return
    setBusyService('appleMusic')
    patchConnection('appleMusic', { status: 'connecting', error: undefined })
    try {
      const instance = await ensureApple(configOverride)
      if (!instance.isAuthorized) {
        await instance.authorize()
      }
      if (!instance.isAuthorized) {
        throw new MusicAuthError(
          'provider',
          'Apple Music did not grant authorization for this account.',
        )
      }
      patchConnection('appleMusic', {
        status: 'connected',
        accountName: 'Apple Music',
        connectedAt: Date.now(),
        error: undefined,
        playbackMode: 'device',
      })
      toast('Apple Music connected', 'success')
      void refreshAll('appleMusic')
    } catch (error) {
      const message = messageFor(error)
      patchConnection('appleMusic', {
        status: looksCancelled(error) ? 'disconnected' : 'error',
        error: message,
      })
      toast(message, 'warn')
    } finally {
      setBusyService(null)
    }
  }, [busyService, ensureApple, patchConnection, refreshAll, toast])

  const disconnect = useCallback(
    async (service: ConnectableService) => {
      setBusyService(service)
      try {
        if (service === 'spotify') {
          spotifyPlayerRef.current?.disconnect()
          spotifyPlayerRef.current = null
          deviceIdRef.current = null
          spotifySdkAttempted.current = false
          clearSpotifySession()
          setSdkState('idle')
          setSdkMessage(null)
        } else {
          const instance = appleRef.current
          if (instance) {
            try {
              instance.stop()
            } catch {
              /* noop */
            }
            try {
              await instance.unauthorize()
            } catch {
              /* user may already be signed out */
            }
          }
          if (appleListenersRef.current && instance) {
            instance.removeEventListener(
              'playbackStateDidChange',
              appleListenersRef.current.state,
            )
            instance.removeEventListener(
              'nowPlayingItemDidChange',
              appleListenersRef.current.item,
            )
          }
          appleListenersRef.current = null
          appleRef.current = null
        }

        if (activeServiceRef.current === service) {
          setActiveService(null)
          setNowPlaying(null)
        }
        patchConnection(service, {
          status: 'disconnected',
          accountName: undefined,
          accountId: undefined,
          connectedAt: undefined,
          error: undefined,
          playbackMode: 'none',
        })
        clearServiceLibraries(service)
        toast(
          service === 'spotify' ? 'Spotify disconnected' : 'Apple Music disconnected',
        )
      } finally {
        setBusyService(null)
      }
    },
    [clearServiceLibraries, patchConnection, toast],
  )

  const playItem = useCallback(
    async (service: ConnectableService, item: MusicItem) => {
      if (!item.playable) {
        toast(
          item.kind === 'artist'
            ? 'Apple Music does not expose artist playback to the web player. Open the artist in Apple Music instead.'
            : 'This item cannot be played inside BASSX.',
          'warn',
        )
        return
      }

      try {
        if (service === 'spotify') {
          if (connectionsRef.current.spotify.status !== 'connected') {
            throw new MusicAuthError('unsupported', 'Connect Spotify before playing.')
          }
          pauseLocalRef.current()
          const useDevice =
            connectionsRef.current.spotify.playbackMode === 'device' &&
            Boolean(deviceIdRef.current)
          const deviceId = useDevice ? deviceIdRef.current ?? undefined : undefined

          if (item.kind === 'track') {
            await spotifyClientRef.current.play({ uri: item.uri, deviceId })
          } else {
            await spotifyClientRef.current.play({ contextUri: item.uri, deviceId })
          }

          setActiveService('spotify')
          setNowPlaying({
            service: 'spotify',
            title: item.title,
            artist: item.subtitle ?? 'Spotify',
            album: item.kind === 'track' ? item.context ?? 'Spotify' : item.title,
            artworkUrl: item.artworkUrl,
            isPlaying: true,
            position: 0,
            duration: 0,
            canSeek: true,
            context: item.kind,
            itemUri: item.uri,
            protectedAudio: true,
            playbackMode: useDevice ? 'device' : 'remote',
          })
          window.setTimeout(() => void pollSpotify(), 900)
          toast(`Playing on Spotify · ${item.title}`, 'success')
        } else {
          const instance = await ensureApple()
          if (!instance.isAuthorized) {
            throw new MusicAuthError('unsupported', 'Connect Apple Music first.')
          }
          pauseLocalRef.current()
          await playAppleItem(instance, item)
          setActiveService('appleMusic')
          setNowPlaying({
            service: 'appleMusic',
            title: item.title,
            artist: item.subtitle ?? 'Apple Music',
            album: item.context ?? item.title,
            artworkUrl: item.artworkUrl,
            isPlaying: true,
            position: 0,
            duration: 0,
            canSeek: true,
            context: item.kind,
            itemUri: item.id,
            protectedAudio: true,
            playbackMode: 'device',
          })
          window.setTimeout(() => syncApple(instance, true), 500)
          toast(`Playing on Apple Music · ${item.title}`, 'success')
        }
      } catch (error) {
        if (!handleAuthFailure(service, error)) {
          toast(messageFor(error), 'warn')
        } else {
          toast(messageFor(error), 'warn')
        }
      }
    },
    [ensureApple, handleAuthFailure, pollSpotify, syncApple, toast],
  )

  const toggleProvider = useCallback(async () => {
    const service = activeServiceRef.current
    if (!service) return
    try {
      if (service === 'spotify') {
        const player = spotifyPlayerRef.current
        if (
          connectionsRef.current.spotify.playbackMode === 'device' &&
          player
        ) {
          await player.togglePlay()
        } else {
          if (nowPlayingRef.current?.isPlaying) {
            await spotifyClientRef.current.pause()
          } else {
            await spotifyClientRef.current.resume()
          }
          window.setTimeout(() => void pollSpotify(), 500)
        }
      } else {
        const instance = appleRef.current
        if (!instance) return
        const state = instance.playbackState
        if (
          state === APPLE_PLAYBACK.paused ||
          state === APPLE_PLAYBACK.stopped ||
          state === APPLE_PLAYBACK.ended ||
          state === APPLE_PLAYBACK.completed
        ) {
          await instance.play()
        } else {
          instance.pause()
        }
        window.setTimeout(() => syncApple(instance, true), 250)
      }
    } catch (error) {
      if (!handleAuthFailure(service, error)) toast(messageFor(error), 'warn')
    }
  }, [handleAuthFailure, pollSpotify, syncApple, toast])

  const providerNext = useCallback(async () => {
    const service = activeServiceRef.current
    if (!service) return
    try {
      if (service === 'spotify') {
        const player = spotifyPlayerRef.current
        if (connectionsRef.current.spotify.playbackMode === 'device' && player) {
          await player.next()
        } else {
          await spotifyClientRef.current.next()
          window.setTimeout(() => void pollSpotify(), 500)
        }
      } else {
        const instance = appleRef.current
        if (!instance) return
        await instance.skipToNextItem()
        window.setTimeout(() => syncApple(instance, true), 400)
      }
    } catch (error) {
      if (!handleAuthFailure(service, error)) toast(messageFor(error), 'warn')
    }
  }, [handleAuthFailure, pollSpotify, syncApple, toast])

  const providerPrevious = useCallback(async () => {
    const service = activeServiceRef.current
    if (!service) return
    try {
      if (service === 'spotify') {
        const player = spotifyPlayerRef.current
        if (connectionsRef.current.spotify.playbackMode === 'device' && player) {
          await player.previous()
        } else {
          await spotifyClientRef.current.previous()
          window.setTimeout(() => void pollSpotify(), 500)
        }
      } else {
        const instance = appleRef.current
        if (!instance) return
        await instance.skipToPreviousItem()
        window.setTimeout(() => syncApple(instance, true), 400)
      }
    } catch (error) {
      if (!handleAuthFailure(service, error)) toast(messageFor(error), 'warn')
    }
  }, [handleAuthFailure, pollSpotify, syncApple, toast])

  const seekProvider = useCallback(
    async (positionMs: number) => {
      const service = activeServiceRef.current
      if (!service) return
      try {
        if (service === 'spotify') {
          const player = spotifyPlayerRef.current
          if (connectionsRef.current.spotify.playbackMode === 'device' && player) {
            await player.seek(positionMs)
          } else {
            await spotifyClientRef.current.seek(positionMs)
            window.setTimeout(() => void pollSpotify(), 400)
          }
        } else {
          const instance = appleRef.current
          if (!instance) return
          await instance.seekToTime(positionMs / 1000)
          window.setTimeout(() => syncApple(instance, true), 250)
        }
      } catch (error) {
        if (!handleAuthFailure(service, error)) toast(messageFor(error), 'warn')
      }
    },
    [handleAuthFailure, pollSpotify, syncApple, toast],
  )

  const stopProvider = useCallback(async () => {
    const service = activeServiceRef.current
    if (!service) return
    try {
      if (service === 'spotify') {
        const player = spotifyPlayerRef.current
        if (connectionsRef.current.spotify.playbackMode === 'device' && player) {
          await player.pause()
        } else {
          await spotifyClientRef.current.pause()
        }
      } else {
        appleRef.current?.pause()
      }
    } catch {
      /* stopping an already-stopped provider is fine */
    }
    setActiveService(null)
    setNowPlaying(null)
  }, [])

  const validateAppleToken = useCallback(
    (token: string) => validatePastedAppleToken(token),
    [],
  )

  // One-time bootstrap: finish OAuth redirects and restore provider sessions.
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    const callback = readSpotifyCallback()
    if (callback.code || callback.error) {
      void finishSpotifyRedirect()
      return
    }
    void restoreSpotify()
    void restoreApple()
  }, [finishSpotifyRedirect, restoreApple, restoreSpotify])

  // Once local audio starts, stop provider playback so two sources never mix.
  useEffect(() => {
    if (!local.isPlaying) return
    const service = activeServiceRef.current
    if (!service) return
    setActiveService(null)
    setNowPlaying(null)
    void (async () => {
      try {
        if (service === 'spotify') {
          const player = spotifyPlayerRef.current
          if (connectionsRef.current.spotify.playbackMode === 'device' && player) {
            await player.pause()
          } else {
            await spotifyClientRef.current.pause()
          }
        } else {
          appleRef.current?.pause()
        }
      } catch {
        /* provider may already be idle */
      }
    })()
  }, [local.isPlaying])

  // Keep the Spotify now-playing card fresh while it is the active source.
  useEffect(() => {
    if (connections.spotify.status !== 'connected') return
    const id = window.setTimeout(() => void pollSpotify(), 1200)
    return () => window.clearTimeout(id)
  }, [connections.spotify.status, pollSpotify])

  useEffect(() => {
    if (activeService !== 'spotify') return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void pollSpotify()
    }, 1500)
    return () => window.clearInterval(id)
  }, [activeService, pollSpotify])

  useEffect(() => {
    if (activeService !== 'appleMusic') return
    const id = window.setInterval(() => {
      const instance = appleRef.current
      if (instance && document.visibilityState === 'visible') {
        syncApple(instance, false)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [activeService, syncApple])

  // Catch playback that started on another Spotify device while BASSX was hidden.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        connectionsRef.current.spotify.status === 'connected'
      ) {
        void pollSpotify()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [pollSpotify])

  const value = useMemo<MusicContextValue>(
    () => ({
      config,
      updateConfig,
      connections,
      libraries,
      busyService,
      sdkState,
      sdkMessage,
      nowPlaying,
      activeService,
      connectSpotify,
      connectAppleMusic,
      disconnect,
      refreshLibrary,
      refreshAll,
      playItem,
      toggleProvider,
      providerNext,
      providerPrevious,
      seekProvider,
      stopProvider,
      validateAppleToken,
      inspectAppleToken,
    }),
    [
      activeService,
      busyService,
      config,
      connectAppleMusic,
      connectSpotify,
      connections,
      disconnect,
      libraries,
      nowPlaying,
      playItem,
      pollSpotify,
      providerNext,
      providerPrevious,
      refreshAll,
      refreshLibrary,
      sdkMessage,
      sdkState,
      seekProvider,
      stopProvider,
      toggleProvider,
      updateConfig,
      validateAppleToken,
    ],
  )

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>
}

export function useMusic(): MusicContextValue {
  const ctx = useContext(MusicContext)
  if (!ctx) throw new Error('useMusic must be used inside MusicProvider')
  return ctx
}
