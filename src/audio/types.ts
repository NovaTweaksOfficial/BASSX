/** Shared audio types and constants for the BASSX engine. */

export const EQ_FREQUENCIES = [
  20, 30, 40, 60, 80, 100, 150, 200, 300, 400, 500, 1000, 2000, 4000, 8000,
  12000, 16000, 20000,
] as const

export const BAND_COUNT = EQ_FREQUENCIES.length

export type BandCount = typeof BAND_COUNT

export type BassSettings = {
  /** Master bass intensity, 0–100. This is the big dashboard knob. */
  intensity: number
  /** Sub-bass emphasis, 0–100. */
  sub: number
  /** Deep bass emphasis, 0–100. */
  deep: number
  /** Mid-bass emphasis, 0–100. */
  mid: number
  /** Overall pre-amp trim in dB, -9…+9. */
  gain: number
  /** Output level, 0–100. */
  output: number
}

export const DEFAULT_BASS: BassSettings = {
  intensity: 62,
  sub: 72,
  deep: 68,
  mid: 52,
  gain: 0,
  output: 88,
}

export const FLAT_BANDS: number[] = EQ_FREQUENCIES.map(() => 0)

export const BASS_BAND_COUNT = 9 // 20 Hz – 400 Hz

export const EQ_RANGE = 12

export type VisualizerStyle = 'spectrum' | 'wave' | 'orb' | 'mirror'

export type ThemeAccent = 'violet' | 'cyan' | 'magenta' | 'lime'

export type Settings = {
  accent: ThemeAccent
  visualizer: VisualizerStyle
  defaultBass: number
  smoothing: number
  headroom: boolean
  haptics: boolean
  reduceMotion: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  accent: 'violet',
  visualizer: 'spectrum',
  defaultBass: 62,
  smoothing: 0.78,
  headroom: true,
  haptics: true,
  reduceMotion: false,
}

export type Preset = {
  id: string
  name: string
  tagline: string
  bass: BassSettings
  bands: number[]
  builtin?: boolean
  createdAt?: number
}

export type HeadphoneProfile = {
  id: string
  name: string
  description: string
  bass: BassSettings
  bands: number[]
  builtin?: boolean
  createdAt?: number
}

export type FrequencyBand = (typeof EQ_FREQUENCIES)[number]

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function formatHz(hz: number): string {
  if (hz >= 1000) return `${hz / 1000} kHz`
  return `${hz} Hz`
}

export function formatHzShort(hz: number): string {
  if (hz >= 1000) return `${hz / 1000}k`
  return `${hz}`
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
