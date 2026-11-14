import { useState } from 'react'
import {
  Cpu,
  Download,
  Info,
  Share,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Waves,
} from 'lucide-react'
import { useEngine } from '../audio/EngineProvider'
import { downloadJson, isIos, signedDb } from '../lib/platform'
import { useApp } from '../state/AppProvider'
import { useInstallPrompt } from '../pwa/useInstallPrompt'
import { APP_VERSION } from '../constants'
import { Modal } from '../ui/Modal'
import { PageHeader } from '../ui/PageHeader'
import { RangeControl, Segmented, Toggle } from '../ui/Controls'
import { SpectrumCanvas } from '../ui/SpectrumCanvas'
import { useToast } from '../ui/ToastProvider'
import type { ThemeAccent, VisualizerStyle } from '../audio/types'

const ACCENTS: Array<{ value: ThemeAccent; label: string }> = [
  { value: 'violet', label: 'Violet' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'magenta', label: 'Magenta' },
  { value: 'lime', label: 'Lime' },
]

const VISUALIZERS: Array<{ value: VisualizerStyle; label: string }> = [
  { value: 'spectrum', label: 'Spectrum' },
  { value: 'wave', label: 'Waveform' },
  { value: 'orb', label: 'Orb' },
  { value: 'mirror', label: 'Mirror' },
]

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    resetEq,
    resetAll,
    exportState,
    bass,
    updateBass,
    customPresets,
    volume,
    setVolume,
  } = useApp()
  const { engine, supported, activate } = useEngine()
  const { canInstall, installed, install } = useInstallPrompt()
  const { toast } = useToast()
  const [resetOpen, setResetOpen] = useState(false)
  const [sweeping, setSweeping] = useState(false)

  const runInstall = async () => {
    if (installed) {
      toast('BASSX is already installed', 'success')
      return
    }
    if (canInstall) {
      const result = await install()
      toast(
        result === 'accepted' ? 'Installing BASSX…' : 'Install dismissed',
        result === 'accepted' ? 'success' : 'default',
      )
      return
    }
    toast(
      isIos()
        ? 'On iPhone: Share → Add to Home Screen'
        : 'Open your browser menu → Install app / Add to Home Screen',
    )
  }

  const runSweep = async () => {
    if (!supported) {
      toast('Web Audio is unavailable in this browser.', 'warn')
      return
    }
    const ok = await activate()
    if (!ok) {
      toast('Tap the page once, then try the sweep again.', 'warn')
      return
    }
    await engine.playTestTone()
    setSweeping(true)
    window.setTimeout(() => setSweeping(false), 8300)
    toast('Test sweep playing through the active chain', 'success')
  }

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="Preferences"
        title={
          <>
            Tune the <span className="text-gradient">experience</span>
          </>
        }
        subtitle="Your settings are stored on this device and restored every time you open BASSX."
      />

      <div className="settings-grid">
        <section className="panel settings-card reveal">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Appearance</p>
              <h2>Signature accent</h2>
            </div>
            <Sparkles size={17} className="panel-head__icon" />
          </div>
          <p className="settings-copy">
            Recolours the glow, visualizer and every illuminated control.
          </p>
          <div className="swatches" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((accent) => (
              <button
                key={accent.value}
                type="button"
                role="radio"
                aria-checked={settings.accent === accent.value}
                className={`swatch swatch--${accent.value} ${
                  settings.accent === accent.value ? 'is-active' : ''
                }`}
                onClick={() => updateSettings({ accent: accent.value })}
              >
                <span className="swatch__dot" />
                <span className="swatch__label">{accent.label}</span>
              </button>
            ))}
          </div>

          <div className="settings-divider" />

          <p className="settings-label">Visualizer style</p>
          <Segmented
            label="Visualizer style"
            value={settings.visualizer}
            onChange={(value) => updateSettings({ visualizer: value })}
            options={VISUALIZERS}
          />
          <div className="visualizer-preview">
            <SpectrumCanvas height={116} style={settings.visualizer} showGrid={false} />
          </div>

          <Toggle
            label="Reduce motion"
            hint="Lower frame rate and softer glow effects."
            checked={settings.reduceMotion}
            onChange={(value) => updateSettings({ reduceMotion: value })}
          />
          <Toggle
            label="Haptic feedback"
            hint="A subtle vibration when supported (Android; iOS ignores it)."
            checked={settings.haptics}
            onChange={(value) => updateSettings({ haptics: value })}
          />
        </section>

        <section className="panel settings-card reveal reveal--delay-1">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Audio engine</p>
              <h2>Processing</h2>
            </div>
            <Cpu size={17} className="panel-head__icon" />
          </div>

          <RangeControl
            label="Default bass level"
            value={settings.defaultBass}
            min={0}
            max={100}
            onChange={(value) => updateSettings({ defaultBass: value })}
            format={(v) => `${Math.round(v)}%`}
            hint="Used as the starting intensity on a fresh install."
          />

          <RangeControl
            label="Analyser smoothing"
            value={settings.smoothing}
            min={0.4}
            max={0.95}
            step={0.01}
            onChange={(value) => updateSettings({ smoothing: value })}
            format={(v) => `${Math.round(v * 100)}%`}
            hint="Smooths the frequency visualizer, not the audio."
          />

          <Toggle
            label="Headroom protection"
            hint="Automatic pre-gain trim and a final limiter to prevent digital clipping."
            checked={settings.headroom}
            onChange={(value) => updateSettings({ headroom: value })}
          />

          <div className="engine-facts">
            <div>
              <span>Sample rate</span>
              <strong>{(engine.sampleRate / 1000).toFixed(1)} kHz</strong>
            </div>
            <div>
              <span>Sub-bass gain</span>
              <strong>{signedDb(0.16 * bass.sub * (bass.intensity / 100))}</strong>
            </div>
            <div>
              <span>Output</span>
              <strong>{Math.round(bass.output)}%</strong>
            </div>
            <div>
              <span>Engine</span>
              <strong>{supported ? 'Web Audio' : 'Unsupported'}</strong>
            </div>
          </div>

          <div className="settings-actions">
            <button type="button" className="ghost-btn" onClick={resetEq}>
              Reset equalizer
            </button>
            <button type="button" className="ghost-btn" onClick={() => void runSweep()}>
              <Waves size={15} /> {sweeping ? 'Sweeping…' : 'Test sweep'}
            </button>
          </div>
        </section>

        <section className="panel settings-card reveal">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Playback</p>
              <h2>Levels</h2>
            </div>
            <ShieldCheck size={17} className="panel-head__icon" />
          </div>
          <RangeControl
            label="Master volume"
            value={volume}
            min={0}
            max={1}
            step={0.01}
            onChange={setVolume}
            format={(v) => `${Math.round(v * 100)}%`}
            hint="Applied after the limiter, so it never changes the processing."
          />
          <RangeControl
            label="Output level"
            value={bass.output}
            min={0}
            max={100}
            onChange={(value) => updateBass({ output: value })}
            format={(v) => `${Math.round(v)}%`}
            hint="The output stage of the bass engine, before master volume."
          />
          <p className="settings-note">
            On iPhone, the hardware volume buttons and Control Center always have
            the final say. BASSX respects the system volume.
          </p>
        </section>

        <section className="panel settings-card reveal reveal--delay-1">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Install &amp; data</p>
              <h2>App</h2>
            </div>
            <Smartphone size={17} className="panel-head__icon" />
          </div>

          <div className="install-card">
            <div className="install-card__copy">
              <strong>{installed ? 'BASSX is installed' : 'Add BASSX to your home screen'}</strong>
              <p>
                {installed
                  ? 'Launch it fullscreen, just like a native app.'
                  : canInstall
                    ? 'Install for a fullscreen, offline-capable experience.'
                    : isIos()
                      ? 'In Safari, tap Share, then “Add to Home Screen”.'
                      : 'Use your browser menu → Install app or Add to Home Screen.'}
              </p>
            </div>
            <button
              type="button"
              className={`ghost-btn ${installed ? 'is-done' : ''}`}
              onClick={() => void runInstall()}
            >
              {installed ? <ShieldCheck size={15} /> : isIos() ? <Share size={15} /> : <Download size={15} />}
              {installed ? 'Installed' : 'Install'}
            </button>
          </div>

          <div className="settings-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                downloadJson('bassx-settings.json', exportState())
                toast('Settings exported', 'success')
              }}
            >
              <Download size={15} /> Export settings
            </button>
            <button
              type="button"
              className="ghost-btn ghost-btn--danger"
              onClick={() => setResetOpen(true)}
            >
              Reset BASSX
            </button>
          </div>

          <p className="settings-note">
            Presets, profiles and preferences live in local storage on this
            device. {customPresets.length} custom preset
            {customPresets.length === 1 ? '' : 's'} saved. No account, no uploads,
            no trackers.
          </p>
        </section>

        <section className="panel about-card reveal">
          <div className="about-card__head">
            <div>
              <p className="eyebrow">About</p>
              <h2>BASSX {APP_VERSION}</h2>
            </div>
            <span className="chip">Web build</span>
          </div>
          <p className="about-card__copy">
            A real-time bass booster, 18-band parametric equalizer, preset library
            and reactive visualizer built with React, TypeScript and the Web Audio
            API. Every control changes the actual DSP graph.
          </p>
          <div className="about-rows">
            <div>
              <span>Runtime</span>
              <strong>React + Web Audio</strong>
            </div>
            <div>
              <span>Storage</span>
              <strong>Local only</strong>
            </div>
            <div>
              <span>Offline</span>
              <strong>PWA cached</strong>
            </div>
            <div>
              <span>Analyser</span>
              <strong>4096 FFT</strong>
            </div>
          </div>

          <div className="notice notice--info about-note">
            <Info size={17} />
            <div>
              <strong>What a browser can and cannot process</strong>
              <p>
                BASSX can process audio you open in the app (local files) and the
                built-in demo. A website cannot capture system-wide audio from
                Spotify, Apple Music, YouTube Music or other apps — no browser
                exposes that. We do not fake it: those sources simply cannot be
                routed through BASSX on the web. A future native iOS/Android build
                can support additional platform-permitted routing.
              </p>
            </div>
          </div>

          <p className="about-card__foot">
            Built for headphones, car systems and anyone who believes the low end
            deserves its own interface.
          </p>
        </section>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        eyebrow="Factory reset"
        title="Reset BASSX?"
        footer={
          <>
            <button type="button" className="ghost-btn" onClick={() => setResetOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-btn primary-btn--danger"
              onClick={() => {
                resetAll()
                setResetOpen(false)
              }}
            >
              Reset everything
            </button>
          </>
        }
      >
        <p className="modal-copy">
          This clears custom presets, headphone profiles, equalizer settings and
          preferences stored in this browser. Your audio files are untouched.
        </p>
      </Modal>
    </div>
  )
}
