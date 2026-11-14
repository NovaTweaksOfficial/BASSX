import {
  DEFAULT_BASS,
  DEFAULT_SETTINGS,
  EQ_FREQUENCIES,
  FLAT_BANDS,
  clamp,
  type BassSettings,
  type HeadphoneProfile,
  type Preset,
  type Settings,
} from '../audio/types'

export type PersistedState = {
  version: 1
  settings: Settings
  bass: BassSettings
  bands: number[]
  activePresetId: string | null
  activeProfileId: string | null
  customPresets: Preset[]
  profiles: HeadphoneProfile[]
  volume: number
  repeat: 'off' | 'all' | 'one'
  shuffle: boolean
}

const KEY = 'bassx.state.v1'

export function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (parsed.version !== 1) return null

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...(isObject(parsed.settings) ? parsed.settings : {}),
    }

    const bass: BassSettings = {
      ...DEFAULT_BASS,
      ...(isObject(parsed.bass) ? parsed.bass : {}),
      intensity: clamp(
        Number(parsed.bass?.intensity ?? DEFAULT_BASS.intensity),
        0,
        100,
      ),
    }

    const bands = sanitizeBands(parsed.bands)
    const customPresets = Array.isArray(parsed.customPresets)
      ? parsed.customPresets.filter(isValidPreset)
      : []
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles.filter(isValidProfile)
      : []

    return {
      version: 1,
      settings,
      bass,
      bands,
      activePresetId:
        typeof parsed.activePresetId === 'string' ? parsed.activePresetId : null,
      activeProfileId:
        typeof parsed.activeProfileId === 'string'
          ? parsed.activeProfileId
          : null,
      customPresets,
      profiles,
      volume: clamp(Number(parsed.volume ?? 0.85), 0, 1),
      repeat:
        parsed.repeat === 'all' || parsed.repeat === 'one' ? parsed.repeat : 'off',
      shuffle: Boolean(parsed.shuffle),
    }
  } catch {
    return null
  }
}

export function savePersisted(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage can be unavailable in private mode — app remains functional */
  }
}

export function clearPersisted(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

function sanitizeBands(input: unknown): number[] {
  if (!Array.isArray(input) || input.length !== EQ_FREQUENCIES.length) {
    return [...FLAT_BANDS]
  }
  return input.map((value) =>
    typeof value === 'number' && Number.isFinite(value)
      ? clamp(value, -12, 12)
      : 0,
  )
}

function isValidPreset(value: unknown): value is Preset {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.bands) &&
    value.bands.length === EQ_FREQUENCIES.length &&
    isObject(value.bass)
  )
}

function isValidProfile(value: unknown): value is HeadphoneProfile {
  if (!isValidPreset(value)) return false
  return 'description' in value && typeof value.description === 'string'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
