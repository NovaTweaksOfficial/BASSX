import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { useEngine } from '../audio/EngineProvider'
import { readTrackMetadata, type TrackMeta } from '../audio/id3'
import { uid } from '../audio/types'
import { useApp } from '../state/AppProvider'
import { useToast } from '../ui/ToastProvider'

export type Track = {
  id: string
  title: string
  artist: string
  album: string
  artworkUrl?: string
  url: string
  isDemo?: boolean
  addedAt: number
  objectUrl?: boolean
  artworkObjectUrl?: boolean
}

type PlayerContextValue = {
  tracks: Track[]
  currentTrack: Track | null
  currentIndex: number
  isPlaying: boolean
  isLoading: boolean
  error: string | null
  time: number
  duration: number
  addFiles: (files: FileList | File[]) => Promise<void>
  removeTrack: (id: string) => void
  playTrack: (id: string) => void
  togglePlay: () => Promise<void>
  next: () => void
  previous: () => void
  seek: (time: number) => void
  audioRef: MutableRefObject<HTMLAudioElement | null>
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

const ACCEPTED = /\.(mp3|wav|wave|m4a|aac|flac|ogg|oga|opus|webm|aiff?|mp4)$/i

const demoUrl = `${import.meta.env.BASE_URL}demo/bassx-demo.wav`
const demoArt = `${import.meta.env.BASE_URL}demo/sub-zero.svg`

const DEMO_TRACK: Track = {
  id: 'bassx-demo',
  title: 'Sub Zero',
  artist: 'BASSX',
  album: 'Demo Transmission 001',
  artworkUrl: demoArt,
  url: demoUrl,
  isDemo: true,
  addedAt: 0,
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { engine, activate, status } = useEngine()
  const { repeat, shuffle, volume } = useApp()
  const { toast } = useToast()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [tracks, setTracks] = useState<Track[]>([DEMO_TRACK])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const pendingAutoplay = useRef(false)
  const indexRef = useRef(0)
  const tracksRef = useRef(tracks)
  const repeatRef = useRef(repeat)
  const shuffleRef = useRef(shuffle)
  const playRef = useRef<() => Promise<void>>(async () => undefined)
  const nextRef = useRef<() => void>(() => undefined)
  const previousRef = useRef<() => void>(() => undefined)

  indexRef.current = currentIndex
  tracksRef.current = tracks
  repeatRef.current = repeat
  shuffleRef.current = shuffle

  const currentTrack = tracks[currentIndex] ?? null

  const play = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    setError(null)
    // iOS requires both the AudioContext unlock and audio.play() to happen
    // inside the tap/click task. Do not await anything before play().
    try {
      void activate()
      engine.attachMediaElementSync(audio)
      const playback = audio.play()
      await playback
    } catch (err) {
      setIsPlaying(false)
      setIsLoading(false)
      const domError = err as DOMException
      if (domError?.name !== 'AbortError') {
        toast(
          domError?.name === 'NotAllowedError'
            ? 'Your browser blocked playback. Tap play once more.'
            : 'Playback was blocked. Tap play again to start audio.',
          'warn',
        )
      }
    }
  }, [activate, engine, toast])
  playRef.current = play

  const handleEnded = useCallback(() => {
    const list = tracksRef.current
    const audio = audioRef.current
    if (repeatRef.current === 'one') {
      if (audio) {
        audio.currentTime = 0
        void playRef.current()
      }
      return
    }
    if (list.length <= 1) {
      if (repeatRef.current === 'all' && audio) {
        audio.currentTime = 0
        void playRef.current()
      } else {
        setIsPlaying(false)
      }
      return
    }
    if (shuffleRef.current) {
      let nextIndex = indexRef.current
      while (nextIndex === indexRef.current) {
        nextIndex = Math.floor(Math.random() * list.length)
      }
      pendingAutoplay.current = true
      setCurrentIndex(nextIndex)
      return
    }
    const atLast = indexRef.current >= list.length - 1
    if (atLast && repeatRef.current === 'off') {
      setIsPlaying(false)
      setTime(0)
      return
    }
    pendingAutoplay.current = true
    setCurrentIndex((indexRef.current + 1) % list.length)
  }, [])

  // Create the single audio element used for the lifetime of the app. All of
  // its output is routed through the BASSX engine on first play.
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.setAttribute('playsinline', 'true')
    audio.volume = 1
    audioRef.current = audio

    const onTime = () => setTime(audio.currentTime)
    const onDuration = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = () => {
      setIsPlaying(true)
      setIsLoading(false)
      setError(null)
      void engine.ensure()
    }
    const onPause = () => setIsPlaying(false)
    const onWaiting = () => setIsLoading(true)
    const onCanPlay = () => setIsLoading(false)
    const onEnded = () => handleEnded()
    const onError = () => {
      setIsPlaying(false)
      setIsLoading(false)
      const message =
        'This file could not be played. The browser may not support its codec — try MP3, M4A, WAV or OGG.'
      setError(message)
      toast(message, 'warn')
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDuration)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onCanPlay)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDuration)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onCanPlay)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.src = ''
      audioRef.current = null
    }
    // The element is created once; refs keep the handlers current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load a new source whenever the selection changes.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    setTime(0)
    setDuration(0)
    setError(null)
    setIsLoading(true)
    audio.src = currentTrack.url
    audio.load()
    if (pendingAutoplay.current || isPlaying) {
      pendingAutoplay.current = false
      void playRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id])

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const all = Array.from(files)
      if (!all.length) return
      const valid = all.filter(
        (file) => file.type.startsWith('audio/') || ACCEPTED.test(file.name),
      )
      if (!valid.length) {
        toast('Those files are not audio. Try MP3, M4A, WAV, FLAC or OGG.', 'warn')
        return
      }
      const loaded: Track[] = []
      for (const file of valid) {
        const url = URL.createObjectURL(file)
        const meta: TrackMeta = await readTrackMetadata(file)
        loaded.push({
          id: uid('track'),
          title: meta.title || stripExtension(file.name),
          artist: meta.artist || 'Unknown artist',
          album: meta.album || 'Local library',
          artworkUrl: meta.artworkUrl,
          url,
          addedAt: Date.now(),
          objectUrl: true,
          artworkObjectUrl: Boolean(meta.artworkUrl),
        })
      }
      const firstNewIndex = tracksRef.current.length
      setTracks((prev) => [...prev, ...loaded])
      pendingAutoplay.current = true
      setCurrentIndex(firstNewIndex)
      toast(
        `${loaded.length} track${loaded.length > 1 ? 's' : ''} added to the deck`,
        'success',
      )
    },
    [toast],
  )

  const removeTrack = useCallback(
    (id: string) => {
      const list = tracksRef.current
      const index = list.findIndex((t) => t.id === id)
      if (index === -1) return
      const track = list[index]
      if (track.objectUrl) URL.revokeObjectURL(track.url)
      if (track.artworkObjectUrl && track.artworkUrl) {
        URL.revokeObjectURL(track.artworkUrl)
      }
      const wasCurrent = index === indexRef.current
      if (wasCurrent) audioRef.current?.pause()
      const nextList = list.filter((t) => t.id !== id)
      const safeList = nextList.length ? nextList : [DEMO_TRACK]
      setTracks(safeList)
      if (index < indexRef.current) {
        setCurrentIndex(indexRef.current - 1)
      } else if (wasCurrent) {
        setCurrentIndex(Math.min(index, safeList.length - 1))
      }
      toast('Track removed')
    },
    [toast],
  )

  const playTrack = useCallback((id: string) => {
    const index = tracksRef.current.findIndex((t) => t.id === id)
    if (index === -1) return
    if (index === indexRef.current) {
      void playRef.current()
      return
    }
    pendingAutoplay.current = true
    setCurrentIndex(index)
  }, [])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src && currentTrack) {
      audio.src = currentTrack.url
      audio.load()
    }
    if (isPlaying) {
      audio.pause()
    } else {
      await play()
    }
  }, [currentTrack, isPlaying, play])

  const next = useCallback(() => {
    const list = tracksRef.current
    if (!list.length) return
    if (shuffleRef.current && list.length > 1) {
      let nextIndex = indexRef.current
      while (nextIndex === indexRef.current) {
        nextIndex = Math.floor(Math.random() * list.length)
      }
      pendingAutoplay.current = isPlaying
      setCurrentIndex(nextIndex)
      return
    }
    pendingAutoplay.current = isPlaying
    setCurrentIndex((indexRef.current + 1) % list.length)
  }, [isPlaying])
  nextRef.current = next

  const previous = useCallback(() => {
    const audio = audioRef.current
    const list = tracksRef.current
    if (!list.length) return
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      setTime(0)
      return
    }
    pendingAutoplay.current = isPlaying
    setCurrentIndex((indexRef.current - 1 + list.length) % list.length)
  }, [isPlaying])
  previousRef.current = previous

  const seek = useCallback((value: number) => {
    const audio = audioRef.current
    if (!audio) return
    const max = Number.isFinite(audio.duration) ? audio.duration : value
    const target = Math.max(0, Math.min(value, max))
    audio.currentTime = target
    setTime(target)
  }, [])

  // Native media session (lock screen / notification controls).
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return
    const artwork = currentTrack.artworkUrl
      ? [{ src: currentTrack.artworkUrl, sizes: '512x512', type: 'image/svg+xml' }]
      : [
          {
            src: `${import.meta.env.BASE_URL}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
        ]
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork,
      })
    } catch {
      /* MediaMetadata can be unavailable on older browsers */
    }
    try {
      navigator.mediaSession.setActionHandler('play', () => void playRef.current())
      navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause())
      navigator.mediaSession.setActionHandler('nexttrack', () => nextRef.current())
      navigator.mediaSession.setActionHandler('previoustrack', () =>
        previousRef.current(),
      )
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null && audioRef.current) {
          audioRef.current.currentTime = details.seekTime
          setTime(details.seekTime)
        }
      })
    } catch {
      /* noop */
    }
  }, [currentTrack])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    } catch {
      /* noop */
    }
  }, [isPlaying])

  // Keep the platform volume in sync through the engine's output stage.
  useEffect(() => {
    engine.setVolume(volume)
    if (audioRef.current) audioRef.current.volume = 1
  }, [engine, volume])

  // If the tab is backgrounded, recover the engine when it returns.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isPlaying && status !== 'running') {
        void engine.ensure()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [engine, isPlaying, status])

  const value = useMemo<PlayerContextValue>(
    () => ({
      tracks,
      currentTrack,
      currentIndex,
      isPlaying,
      isLoading,
      error,
      time,
      duration,
      addFiles,
      removeTrack,
      playTrack,
      togglePlay,
      next,
      previous,
      seek,
      audioRef,
    }),
    [
      tracks,
      currentTrack,
      currentIndex,
      isPlaying,
      isLoading,
      error,
      time,
      duration,
      addFiles,
      removeTrack,
      playTrack,
      togglePlay,
      next,
      previous,
      seek,
    ],
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Untitled track'
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}
