import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  AudioLines,
  Disc3,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Pause,
} from 'lucide-react'
import { useEngine } from '../audio/EngineProvider'
import { useApp } from '../state/AppProvider'
import { usePlayer } from '../player/PlayerProvider'
import { Knob } from '../ui/Knob'
import { SpectrumCanvas } from '../ui/SpectrumCanvas'
import { RangeControl } from '../ui/Controls'
import { CurvePreview } from '../ui/CurvePreview'
import { signedDb } from '../lib/platform'

export function HomePage() {
  const { engine, status, supported } = useEngine()
  const {
    bass,
    updateBass,
    bands,
    activePreset,
    activeProfile,
    presets,
    settings,
  } = useApp()
  const { currentTrack, isPlaying, togglePlay } = usePlayer()

  const intensity = Math.max(0, bass.intensity) / 100
  const gains = {
    sub: 0.16 * bass.sub * intensity,
    deep: 0.145 * bass.deep * intensity,
    mid: 0.13 * bass.mid * intensity,
  }
  const live = supported && status === 'running'

  return (
    <div className="page home-page">
      <header className="home-hero reveal">
        <div className="home-hero__text">
          <p className="eyebrow">
            <span className="eyebrow__dot" /> Bass intelligence
          </p>
          <h1>
            Low end,
            <br />
            <span className="text-gradient">perfected.</span>
          </h1>
          <p className="lede">
            Real-time sub-bass shaping, a studio-grade 18-band engine and a
            visualizer that moves with every kick.
          </p>
        </div>
        <div className="hero-readout">
          <div>
            <span>Sample rate</span>
            <strong>{(engine.sampleRate / 1000).toFixed(1)} kHz</strong>
          </div>
          <div>
            <span>Analyser</span>
            <strong>4096 FFT</strong>
          </div>
          <div>
            <span>Status</span>
            <strong className={live ? 'is-live' : ''}>
              {live ? 'Live' : supported ? 'Standby' : 'Unsupported'}
            </strong>
          </div>
        </div>
      </header>

      {!supported && (
        <div className="notice notice--warn reveal">
          <Activity size={17} />
          <p>
            This browser does not expose the Web Audio API. You can browse the
            interface, but real-time processing is unavailable.
          </p>
        </div>
      )}

      <div className="home-grid">
        <section className="panel spectrum-panel reveal">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Live analyser</p>
              <h2>Frequency spectrum</h2>
            </div>
            <span className={`live-chip ${isPlaying ? 'is-live' : ''}`}>
              <span className="live-chip__dot" />
              {isPlaying ? 'Audio live' : 'Waiting for audio'}
            </span>
          </div>

          <SpectrumCanvas height={188} />

          <div className="spectrum-axis" aria-hidden="true">
            <span>20 Hz</span>
            <span>100</span>
            <span>1k</span>
            <span>10k</span>
            <span>20 kHz</span>
          </div>

          <div className="spectrum-foot">
            <button
              type="button"
              className="primary-btn primary-btn--compact"
              onClick={() => void togglePlay()}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying
                ? 'Pause'
                : currentTrack?.isDemo
                  ? 'Play demo'
                  : 'Resume audio'}
            </button>
            <p>
              {currentTrack ? (
                <>
                  <span className="eq-indicator" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  {currentTrack.title} — {currentTrack.artist}
                </>
              ) : (
                'Load a track to feed the analyser'
              )}
            </p>
            <Link to="/player" className="text-link">
              Deck <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>

        <section className="panel knob-panel reveal reveal--delay-1">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Bass engine</p>
              <h2>Drive</h2>
            </div>
            <Link to="/presets" className="chip chip--link">
              <Sparkles size={12} />
              {activePreset?.name ?? 'Custom curve'}
            </Link>
          </div>

          <div className="knob-stage">
            <Knob
              value={bass.intensity}
              onChange={(value) => updateBass({ intensity: value })}
              sublabel={activeProfile ? `Tuned for ${activeProfile.name}` : 'Master intensity'}
            />
          </div>

          <div className="knob-stats">
            <div>
              <span>Sub-bass</span>
              <strong>{signedDb(gains.sub)}</strong>
            </div>
            <div>
              <span>Deep bass</span>
              <strong>{signedDb(gains.deep)}</strong>
            </div>
            <div>
              <span>Mid-bass</span>
              <strong>{signedDb(gains.mid)}</strong>
            </div>
          </div>

          <div className="knob-foot">
            <Link to="/equalizer" className="text-link">
              <SlidersHorizontal size={14} /> Shape curve
            </Link>
            <span className={`engine-dot ${live ? 'is-live' : ''}`}>
              <span /> {live ? 'DSP live' : 'DSP standby'}
            </span>
          </div>
        </section>

        <section className="panel contour-panel reveal reveal--delay-2">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Low frequency</p>
              <h2>Bass contour</h2>
            </div>
            <Link to="/equalizer" className="text-link">
              Full EQ <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="contour-grid">
            <RangeControl
              label="Sub-bass"
              value={bass.sub}
              min={0}
              max={100}
              onChange={(value) => updateBass({ sub: value })}
              format={(v) => `${Math.round(v)}%`}
              hint={`${signedDb(gains.sub)} shelf · 32 Hz`}
            />
            <RangeControl
              label="Deep bass"
              value={bass.deep}
              min={0}
              max={100}
              onChange={(value) => updateBass({ deep: value })}
              format={(v) => `${Math.round(v)}%`}
              hint={`${signedDb(gains.deep)} bell · 70 Hz`}
            />
            <RangeControl
              label="Mid-bass"
              value={bass.mid}
              min={0}
              max={100}
              onChange={(value) => updateBass({ mid: value })}
              format={(v) => `${Math.round(v)}%`}
              hint={`${signedDb(gains.mid)} bell · 140 Hz`}
            />
          </div>

          <div className="headroom-row">
            <ShieldCheck size={15} />
            <span>
              {settings.headroom
                ? 'Automatic headroom + limiter engaged to prevent clipping'
                : 'Headroom protection is off — watch your levels'}
            </span>
          </div>
        </section>

        <section className="quick-section reveal reveal--delay-3">
          <div className="quick-grid">
            <Link to="/equalizer" className="quick-card">
              <span className="quick-card__icon">
                <SlidersHorizontal size={19} />
              </span>
              <span className="quick-card__eyebrow">Tone shaping</span>
              <strong>18-band EQ</strong>
              <span className="quick-card__meta">20 Hz — 20 kHz</span>
              <span className="quick-card__spark" aria-hidden="true">
                <CurvePreview bands={bands} height={38} />
              </span>
            </Link>

            <Link to="/player" className="quick-card">
              <span className="quick-card__icon">
                <Disc3 size={19} />
              </span>
              <span className="quick-card__eyebrow">Now on deck</span>
              <strong>{currentTrack?.title ?? 'Player'}</strong>
              <span className="quick-card__meta">
                {currentTrack?.artist ?? 'Open your library'}
              </span>
              <span className="quick-card__glyph">
                <AudioLines size={44} strokeWidth={1} />
              </span>
            </Link>

            <Link to="/presets" className="quick-card">
              <span className="quick-card__icon">
                <Sparkles size={19} />
              </span>
              <span className="quick-card__eyebrow">Sound library</span>
              <strong>Presets</strong>
              <span className="quick-card__meta">
                {presets.length} signature &amp; custom
              </span>
              <span className="quick-card__glyph">
                <Activity size={44} strokeWidth={1} />
              </span>
            </Link>
          </div>
        </section>
      </div>

      <p className="page-note">
        BASSX processes audio opened inside this app. System-wide apps such as
        Spotify or Apple Music cannot be routed through a browser —{' '}
        <Link to="/settings">read the compatibility note</Link>.
      </p>
    </div>
  )
}
