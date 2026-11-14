import {
  BASS_BAND_COUNT,
  DEFAULT_BASS,
  EQ_FREQUENCIES,
  clamp,
  type BassSettings,
} from './types'

/**
 * BASSX audio engine.
 *
 * Signal graph:
 *
 *   media element / stream / test tone
 *        │
 *   input trim
 *        │
 *   sub-bass low shelf (32 Hz) ─ deep-bass bell (70 Hz) ─ mid-bass bell (140 Hz)
 *        │
 *   18-band peaking equalizer (20 Hz … 20 kHz)
 *        │
 *   pre-amp + automatic headroom trim
 *        │
 *   compressor ─ soft saturation ─ makeup gain ─ output level
 *        │
 *   final brick-wall limiter
 *        │
 *   analyser ─ master volume ─ destination
 *
 * The engine is deliberately independent of React and of the player. A future
 * native wrapper can reuse the same parameter model, or swap in platform audio
 * routing, without touching the UI.
 */
export class BassEngine {
  private ctx: AudioContext | null = null
  private input: GainNode | null = null
  private subFilter: BiquadFilterNode | null = null
  private deepFilter: BiquadFilterNode | null = null
  private midFilter: BiquadFilterNode | null = null
  private eqFilters: BiquadFilterNode[] = []
  private preGain: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private shaper: WaveShaperNode | null = null
  private makeup: GainNode | null = null
  private outputGain: GainNode | null = null
  private limiter: DynamicsCompressorNode | null = null
  private analyser: AnalyserNode | null = null
  private volume: GainNode | null = null

  private mediaSource: MediaElementAudioSourceNode | null = null
  private streamSource: MediaStreamAudioSourceNode | null = null
  private testOsc: OscillatorNode | null = null
  private testGain: GainNode | null = null
  private testTimer: number | null = null

  private bands: number[] = EQ_FREQUENCIES.map(() => 0)
  private bass: BassSettings = { ...DEFAULT_BASS }
  private headroom = true
  private userVolume = 0.85
  private disposed = false
  private stateListener: ((state: AudioContextState) => void) | null = null

  readonly supported =
    typeof window !== 'undefined' &&
    'AudioContext' in window &&
    typeof window.AudioContext === 'function'

  get context(): AudioContext | null {
    return this.ctx
  }

  get state(): AudioContextState | 'unsupported' | 'idle' {
    if (!this.supported) return 'unsupported'
    return this.ctx?.state ?? 'idle'
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 44100
  }

  /**
   * Creates (once) and resumes the context *synchronously*.
   * iOS only unlocks audio when resume() is called inside the tap/click task,
   * so the gesture handlers call this directly before awaiting anything.
   */
  armSync(): AudioContext | null {
    if (!this.supported || this.disposed) return null
    if (!this.ctx) this.build()
    const ctx = this.ctx
    if (!ctx) return null
    // Safari can report "interrupted" (calls, Siri, route changes) as well as
    // "suspended". Resume for anything that is not already running/closed.
    if (ctx.state !== 'running' && ctx.state !== 'closed') {
      try {
        void ctx.resume().catch(() => {
          /* the next gesture retries */
        })
      } catch {
        /* the next gesture retries */
      }
    }
    return ctx
  }

  /** Lazily builds the graph. Must be called from a user gesture on iOS. */
  async ensure(): Promise<AudioContext | null> {
    const ctx = this.armSync()
    if (!ctx) return null
    if (ctx.state !== 'running' && ctx.state !== 'closed') {
      try {
        await ctx.resume()
      } catch {
        /* the browser will retry on the next gesture */
      }
    }
    return ctx
  }

  /** Subscribe to AudioContext state changes (running / suspended / interrupted). */
  onStateChange(listener: (state: AudioContextState) => void): () => void {
    this.stateListener = listener
    return () => {
      if (this.stateListener === listener) this.stateListener = null
    }
  }

  private build(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor({ latencyHint: 'interactive' })
    this.ctx = ctx
    ctx.addEventListener('statechange', () => this.stateListener?.(ctx.state))

    this.input = ctx.createGain()
    this.input.gain.value = 1

    this.subFilter = ctx.createBiquadFilter()
    this.subFilter.type = 'lowshelf'
    this.subFilter.frequency.value = 32

    this.deepFilter = ctx.createBiquadFilter()
    this.deepFilter.type = 'peaking'
    this.deepFilter.frequency.value = 70
    this.deepFilter.Q.value = 0.85

    this.midFilter = ctx.createBiquadFilter()
    this.midFilter.type = 'peaking'
    this.midFilter.frequency.value = 140
    this.midFilter.Q.value = 0.9

    this.eqFilters = EQ_FREQUENCIES.map((hz, index) => {
      const f = ctx.createBiquadFilter()
      f.type = 'peaking'
      f.frequency.value = hz
      f.Q.value = index < 4 ? 1.15 : index < 9 ? 1 : index > 13 ? 0.85 : 1
      f.gain.value = 0
      return f
    })

    this.preGain = ctx.createGain()
    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -8
    this.compressor.knee.value = 6
    this.compressor.ratio.value = 12
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.22

    this.shaper = ctx.createWaveShaper()
    this.shaper.curve = makeSoftClipCurve(1.35)
    this.shaper.oversample = '4x'
    this.makeup = ctx.createGain()
    this.makeup.gain.value = 1

    this.outputGain = ctx.createGain()
    this.outputGain.gain.value = 0.88

    this.limiter = ctx.createDynamicsCompressor()
    this.limiter.threshold.value = -1.5
    this.limiter.knee.value = 0
    this.limiter.ratio.value = 20
    this.limiter.attack.value = 0.001
    this.limiter.release.value = 0.12

    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 4096
    this.analyser.smoothingTimeConstant = 0.78
    this.analyser.minDecibels = -96
    this.analyser.maxDecibels = -8

    this.volume = ctx.createGain()
    this.volume.gain.value = this.userVolume

    const chain: AudioNode[] = [
      this.input,
      this.subFilter,
      this.deepFilter,
      this.midFilter,
      ...this.eqFilters,
      this.preGain,
      this.compressor,
      this.shaper,
      this.makeup,
      this.outputGain,
      this.limiter,
      this.analyser,
      this.volume,
    ]
    for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1])
    this.volume.connect(ctx.destination)

    // Apply any state that was set before the context existed.
    this.writeBass(false)
    this.writeBands(false)
    this.writeGain(false)
    this.writeVolume(false)
  }

  /**
   * Connects a media element synchronously, so callers can start playback in
   * the same user-gesture task (required by iOS). Safe to call repeatedly.
   */
  attachMediaElementSync(el: HTMLMediaElement): boolean {
    const ctx = this.armSync()
    if (!ctx || !this.input) return false
    if (this.mediaSource) return true
    try {
      this.mediaSource = ctx.createMediaElementSource(el)
      this.mediaSource.connect(this.input)
      return true
    } catch (error) {
      console.warn('[BASSX] Could not attach media element', error)
      return false
    }
  }

  /** Creates (once) and connects a media element to the processing chain. */
  async attachMediaElement(el: HTMLMediaElement): Promise<boolean> {
    const ctx = await this.ensure()
    if (!ctx) return false
    return this.attachMediaElementSync(el)
  }

  /** Optional line-in support (microphone, interface, future native bridge). */
  async connectStream(stream: MediaStream): Promise<boolean> {
    const ctx = await this.ensure()
    if (!ctx || !this.input) return false
    this.streamSource?.disconnect()
    this.streamSource = ctx.createMediaStreamSource(stream)
    this.streamSource.connect(this.input)
    return true
  }

  setBands(bands: number[], smoothed = true): void {
    this.bands = bands.slice(0, EQ_FREQUENCIES.length)
    if (this.eqFilters.length) this.writeBands(smoothed)
    this.writeGain(smoothed)
  }

  setBass(bass: BassSettings, headroom = true): void {
    this.bass = { ...bass }
    this.headroom = headroom
    if (this.subFilter) this.writeBass(true)
    this.writeGain(true)
  }

  setHeadroom(enabled: boolean): void {
    this.headroom = enabled
    this.writeGain(true)
  }

  setVolume(value: number): void {
    this.userVolume = clamp(value, 0, 1)
    if (this.volume) this.writeVolume(true)
  }

  setSmoothing(value: number): void {
    if (this.analyser) {
      this.analyser.smoothingTimeConstant = clamp(value, 0, 0.97)
    }
  }

  private smooth(param: AudioParam | undefined, value: number, smooth = true): void {
    if (!param) return
    if (!smooth || !this.ctx) {
      param.value = value
      return
    }
    param.setTargetAtTime(value, this.ctx.currentTime, 0.045)
  }

  private writeBass(smooth: boolean): void {
    const b = this.bass
    const i = clamp(b.intensity, 0, 100) / 100
    // Electronically safe ranges: never more than 16 dB in a single shelf.
    const subDb = 0.16 * b.sub * i
    const deepDb = 0.145 * b.deep * i
    const midDb = 0.13 * b.mid * i
    this.smooth(this.subFilter?.gain, subDb, smooth)
    this.smooth(this.deepFilter?.gain, deepDb, smooth)
    this.smooth(this.midFilter?.gain, midDb, smooth)
  }

  private writeBands(smooth: boolean): void {
    this.bands.forEach((gain, index) => {
      this.smooth(
        this.eqFilters[index]?.gain,
        clamp(gain, -12, 12),
        smooth,
      )
    })
  }

  private writeGain(smooth: boolean): void {
    if (!this.ctx) return
    const b = this.bass
    const i = clamp(b.intensity, 0, 100) / 100
    const bassBoost = Math.max(
      0,
      0.16 * b.sub * i,
      0.145 * b.deep * i,
      0.13 * b.mid * i,
    )
    const eqBoost = Math.max(0, ...this.bands)
    const maxBoost = Math.max(bassBoost, eqBoost)

    // Automatic headroom keeps heavily boosted presets from slamming the
    // limiter. Half of the theoretical boost is reclaimed after saturation so
    // the app stays loud without clipping.
    const headroomDb = this.headroom ? Math.min(11, maxBoost * 0.42) : 0
    const trimDb = clamp(b.gain, -9, 9) - headroomDb
    const pre = Math.min(2, 10 ** (trimDb / 20))
    const makeup = 10 ** ((headroomDb * 0.55) / 20)

    this.smooth(this.preGain?.gain, pre, smooth)
    this.smooth(this.makeup?.gain, makeup, smooth)
    this.smooth(this.outputGain?.gain, clamp(b.output, 0, 100) / 100, smooth)
    this.headroomReduction = headroomDb
  }

  private writeVolume(smooth: boolean): void {
    this.smooth(this.volume?.gain, this.userVolume, smooth)
  }

  /** Live headroom trim in dB, for the UI meter. */
  headroomReduction = 0

  /** Effective bass shelf gains in dB, for display. */
  getBassGains(): { sub: number; deep: number; mid: number } {
    const b = this.bass
    const i = clamp(b.intensity, 0, 100) / 100
    return {
      sub: 0.16 * b.sub * i,
      deep: 0.145 * b.deep * i,
      mid: 0.13 * b.mid * i,
    }
  }

  getFrequencyBinCount(): number {
    return this.analyser?.frequencyBinCount ?? 2048
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  readFrequency(target: Uint8Array): boolean {
    if (!this.analyser) return false
    this.analyser.getByteFrequencyData(target)
    return true
  }

  readWaveform(target: Uint8Array): boolean {
    if (!this.analyser) return false
    this.analyser.getByteTimeDomainData(target)
    return true
  }

  /**
   * A real low-frequency sweep routed through the active filter chain.
   * Useful for auditioning a preset on phone speakers/headphones without
   * finding a file. Returns a stop function.
   */
  async playTestTone(): Promise<() => void> {
    const ctx = await this.ensure()
    if (!ctx || !this.input) return () => undefined
    this.stopTestTone()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(32, now)
    osc.frequency.exponentialRampToValueAtTime(110, now + 7)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.4)
    gain.gain.setValueAtTime(0.22, now + 7)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 8)
    osc.connect(gain).connect(this.input)
    osc.start(now)
    osc.stop(now + 8.2)
    this.testOsc = osc
    this.testGain = gain
    this.testTimer = window.setTimeout(() => this.stopTestTone(), 8400)
    return () => this.stopTestTone()
  }

  stopTestTone(): void {
    if (this.testTimer !== null) {
      window.clearTimeout(this.testTimer)
      this.testTimer = null
    }
    try {
      this.testOsc?.stop()
      this.testOsc?.disconnect()
      this.testGain?.disconnect()
    } catch {
      /* already stopped */
    }
    this.testOsc = null
    this.testGain = null
  }

  /** True when this engine is producing analyser data. */
  get isLive(): boolean {
    return !!this.ctx && this.ctx.state === 'running'
  }

  async suspend(): Promise<void> {
    if (this.ctx?.state === 'running') {
      try {
        await this.ctx.suspend()
      } catch {
        /* noop */
      }
    }
  }

  dispose(): void {
    this.disposed = true
    this.stopTestTone()
    this.mediaSource?.disconnect()
    this.streamSource?.disconnect()
    this.eqFilters.forEach((f) => f.disconnect())
    try {
      void this.ctx?.close()
    } catch {
      /* noop */
    }
    this.ctx = null
  }
}

function makeSoftClipCurve(k: number): Float32Array {
  const samples = 2048
  const curve = new Float32Array(samples)
  const norm = Math.tanh(k)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    curve[i] = Math.tanh(k * x) / norm
  }
  return curve
}

let engineSingleton: BassEngine | null = null

export function getEngine(): BassEngine {
  if (!engineSingleton) engineSingleton = new BassEngine()
  return engineSingleton
}

export const BASS_BANDS = BASS_BAND_COUNT
