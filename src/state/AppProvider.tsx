import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useEngine } from '../audio/EngineProvider'
import {
  BUILTIN_PRESETS,
  BUILTIN_PROFILES,
} from '../audio/presets'
import {
  BAND_COUNT,
  DEFAULT_BASS,
  DEFAULT_SETTINGS,
  FLAT_BANDS,
  clamp,
  uid,
  type BassSettings,
  type HeadphoneProfile,
  type Preset,
  type Settings,
} from '../audio/types'
import { useToast } from '../ui/ToastProvider'
import {
  clearPersisted,
  loadPersisted,
  savePersisted,
  type PersistedState,
} from './storage'

type AppContextValue = {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  bass: BassSettings
  updateBass: (patch: Partial<BassSettings>) => void
  bands: number[]
  setBand: (index: number, gain: number) => void
  setBands: (bands: number[]) => void
  resetEq: () => void
  activePresetId: string | null
  activePreset: Preset | null
  presets: Preset[]
  customPresets: Preset[]
  applyPreset: (preset: Preset) => void
  saveCurrentPreset: (name: string) => Preset | null
  updateCustomPreset: (id: string, patch: Partial<Preset>) => void
  deleteCustomPreset: (id: string) => void
  profiles: HeadphoneProfile[]
  activeProfileId: string | null
  activeProfile: HeadphoneProfile | null
  applyProfile: (profile: HeadphoneProfile) => void
  saveCurrentProfile: (name: string, description: string) => HeadphoneProfile
  deleteCustomProfile: (id: string) => void
  resetAll: () => void
  exportState: () => PersistedState
  volume: number
  setVolume: (volume: number) => void
  repeat: 'off' | 'all' | 'one'
  setRepeat: (repeat: 'off' | 'all' | 'one') => void
  shuffle: boolean
  toggleShuffle: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const clampBass = (bass: BassSettings): BassSettings => ({
  intensity: clamp(bass.intensity, 0, 100),
  sub: clamp(bass.sub, 0, 100),
  deep: clamp(bass.deep, 0, 100),
  mid: clamp(bass.mid, 0, 100),
  gain: clamp(bass.gain, -9, 9),
  output: clamp(bass.output, 0, 100),
})

export function AppProvider({ children }: { children: ReactNode }) {
  const { engine } = useEngine()
  const { toast } = useToast()
  const initial = useMemo(() => loadPersisted(), [])

  const [settings, setSettings] = useState<Settings>(
    initial?.settings ?? DEFAULT_SETTINGS,
  )
  const [bass, setBassState] = useState<BassSettings>(() => {
    if (initial?.bass) return clampBass(initial.bass)
    return clampBass({ ...DEFAULT_BASS, intensity: settings.defaultBass })
  })
  const [bands, setBandsState] = useState<number[]>(
    initial?.bands?.length === BAND_COUNT ? initial.bands : [...FLAT_BANDS],
  )
  const [customPresets, setCustomPresets] = useState<Preset[]>(
    initial?.customPresets ?? [],
  )
  const [profiles, setProfiles] = useState<HeadphoneProfile[]>([
    ...BUILTIN_PROFILES,
    ...(initial?.profiles ?? []),
  ])
  const [activePresetId, setActivePresetId] = useState<string | null>(
    initial?.activePresetId ?? null,
  )
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    initial?.activeProfileId ?? null,
  )
  const [volume, setVolumeState] = useState(initial?.volume ?? 0.85)
  const [repeat, setRepeatState] = useState<'off' | 'all' | 'one'>(
    initial?.repeat ?? 'off',
  )
  const [shuffle, setShuffle] = useState(initial?.shuffle ?? false)

  const presets = useMemo(
    () => [...BUILTIN_PRESETS, ...customPresets],
    [customPresets],
  )

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) ?? null,
    [presets, activePresetId],
  )
  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId],
  )

  // Push DSP state into the audio graph whenever it changes. This runs even
  // while the context is idle; parameters are stored and applied on start.
  useEffect(() => {
    engine.setBands(bands)
  }, [bands, engine])

  useEffect(() => {
    engine.setBass(bass, settings.headroom)
  }, [bass, settings.headroom, engine])

  useEffect(() => {
    engine.setSmoothing(settings.smoothing)
  }, [settings.smoothing, engine])

  useEffect(() => {
    engine.setVolume(volume)
  }, [volume, engine])

  // Theme + motion preferences are expressed as data attributes consumed by CSS.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.accent = settings.accent
    root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full'
    root.style.setProperty('--eq-smoothing', String(settings.smoothing))
  }, [settings.accent, settings.reduceMotion, settings.smoothing])

  // Persist everything except the transient playlist / decoded files.
  useEffect(() => {
    savePersisted({
      version: 1,
      settings,
      bass,
      bands,
      activePresetId,
      activeProfileId,
      customPresets,
      profiles: profiles.filter((p) => !p.builtin),
      volume,
      repeat,
      shuffle,
    })
  }, [
    settings,
    bass,
    bands,
    activePresetId,
    activeProfileId,
    customPresets,
    profiles,
    volume,
    repeat,
    shuffle,
  ])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateBass = useCallback(
    (patch: Partial<BassSettings>) => {
      setBassState((prev) => clampBass({ ...prev, ...patch }))
      setActivePresetId(null)
      setActiveProfileId(null)
    },
    [],
  )

  const setBand = useCallback((index: number, gain: number) => {
    setBandsState((prev) => {
      const next = [...prev]
      next[index] = clamp(Math.round(gain * 10) / 10, -12, 12)
      return next
    })
    setActivePresetId(null)
    setActiveProfileId(null)
  }, [])

  const setBands = useCallback((next: number[]) => {
    setBandsState(
      next.slice(0, BAND_COUNT).map((g) => clamp(Math.round(g * 10) / 10, -12, 12)),
    )
  }, [])

  const resetEq = useCallback(() => {
    setBandsState([...FLAT_BANDS])
    setActivePresetId(null)
    setActiveProfileId(null)
    toast('Equalizer reset to flat', 'success')
  }, [toast])

  const applyPreset = useCallback(
    (preset: Preset) => {
      setBassState(clampBass({ ...preset.bass }))
      setBandsState(preset.bands.map((g) => clamp(g, -12, 12)))
      setActivePresetId(preset.id)
      setActiveProfileId(null)
      toast(`${preset.name} engaged`, 'success')
    },
    [toast],
  )

  const saveCurrentPreset = useCallback(
    (name: string): Preset | null => {
      const trimmed = name.trim()
      if (!trimmed) {
        toast('Give your preset a name first', 'warn')
        return null
      }
      const preset: Preset = {
        id: uid('preset'),
        name: trimmed.slice(0, 32),
        tagline: 'Custom sound profile',
        bass: { ...bass },
        bands: [...bands],
        createdAt: Date.now(),
      }
      setCustomPresets((prev) => [...prev, preset])
      setActivePresetId(preset.id)
      setActiveProfileId(null)
      toast(`“${preset.name}” saved`, 'success')
      return preset
    },
    [bass, bands, toast],
  )

  const updateCustomPreset = useCallback(
    (id: string, patch: Partial<Preset>) => {
      setCustomPresets((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      )
      toast('Preset updated', 'success')
    },
    [toast],
  )

  const deleteCustomPreset = useCallback(
    (id: string) => {
      setCustomPresets((prev) => prev.filter((p) => p.id !== id))
      setActivePresetId((current) => (current === id ? null : current))
      toast('Preset deleted')
    },
    [toast],
  )

  const applyProfile = useCallback(
    (profile: HeadphoneProfile) => {
      setBassState(clampBass({ ...profile.bass }))
      setBandsState(profile.bands.map((g) => clamp(g, -12, 12)))
      setActiveProfileId(profile.id)
      setActivePresetId(null)
      toast(`Tuned for ${profile.name}`, 'success')
    },
    [toast],
  )

  const saveCurrentProfile = useCallback(
    (name: string, description: string): HeadphoneProfile => {
      const profile: HeadphoneProfile = {
        id: uid('profile'),
        name: name.trim().slice(0, 32) || 'My headphones',
        description: description.trim().slice(0, 90) || 'Custom headphone profile',
        bass: { ...bass },
        bands: [...bands],
        createdAt: Date.now(),
      }
      setProfiles((prev) => [...prev, profile])
      setActiveProfileId(profile.id)
      setActivePresetId(null)
      toast(`“${profile.name}” profile saved`, 'success')
      return profile
    },
    [bass, bands, toast],
  )

  const deleteCustomProfile = useCallback(
    (id: string) => {
      setProfiles((prev) => prev.filter((p) => p.id !== id || p.builtin))
      setActiveProfileId((current) => (current === id ? null : current))
      toast('Headphone profile removed')
    },
    [toast],
  )

  const resetAll = useCallback(() => {
    clearPersisted()
    setSettings(DEFAULT_SETTINGS)
    setBassState({ ...DEFAULT_BASS, intensity: DEFAULT_SETTINGS.defaultBass })
    setBandsState([...FLAT_BANDS])
    setActivePresetId(null)
    setActiveProfileId(null)
    setCustomPresets([])
    setProfiles([...BUILTIN_PROFILES])
    setVolumeState(0.85)
    setRepeatState('off')
    setShuffle(false)
    toast('BASSX reset to factory state', 'success')
  }, [toast])

  const setVolume = useCallback((next: number) => {
    setVolumeState(clamp(next, 0, 1))
  }, [])

  const setRepeat = useCallback((next: 'off' | 'all' | 'one') => {
    setRepeatState(next)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev)
  }, [])

  const exportState = useCallback(
    (): PersistedState => ({
      version: 1,
      settings,
      bass,
      bands,
      activePresetId,
      activeProfileId,
      customPresets,
      profiles: profiles.filter((p) => !p.builtin),
      volume,
      repeat,
      shuffle,
    }),
    [
      settings,
      bass,
      bands,
      activePresetId,
      activeProfileId,
      customPresets,
      profiles,
      volume,
      repeat,
      shuffle,
    ],
  )

  const value: AppContextValue = {
    settings,
    updateSettings,
    bass,
    updateBass,
    bands,
    setBand,
    setBands,
    resetEq,
    activePresetId,
    activePreset,
    presets,
    customPresets,
    applyPreset,
    saveCurrentPreset,
    updateCustomPreset,
    deleteCustomPreset,
    profiles,
    activeProfileId,
    activeProfile,
    applyProfile,
    saveCurrentProfile,
    deleteCustomProfile,
    resetAll,
    exportState,
    volume,
    setVolume,
    repeat,
    setRepeat,
    shuffle,
    toggleShuffle,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
