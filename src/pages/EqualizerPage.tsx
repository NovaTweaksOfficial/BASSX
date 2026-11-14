import { useEffect, useRef, useState } from 'react'
import { BookmarkPlus, RotateCcw, ShieldCheck, Waves } from 'lucide-react'
import { useEngine } from '../audio/EngineProvider'
import { signedDb } from '../lib/platform'
import { useApp } from '../state/AppProvider'
import { FrequencyCurve } from '../ui/FrequencyCurve'
import { EqSliders } from '../ui/EqSliders'
import { Modal } from '../ui/Modal'
import { PageHeader } from '../ui/PageHeader'
import { RangeControl, Segmented } from '../ui/Controls'
import { useToast } from '../ui/ToastProvider'

export function EqualizerPage() {
  const {
    bands,
    setBand,
    bass,
    updateBass,
    resetEq,
    saveCurrentPreset,
    activePreset,
    settings,
    presets,
  } = useApp()
  const { engine, activate, supported } = useEngine()
  const { toast } = useToast()
  const [focus, setFocus] = useState<'full' | 'bass'>('full')
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const [sweeping, setSweeping] = useState(false)
  const sweepTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (sweepTimer.current) window.clearTimeout(sweepTimer.current)
      engine.stopTestTone()
    },
    [engine],
  )

  const intensity = bass.intensity / 100
  const gains = {
    sub: 0.16 * bass.sub * intensity,
    deep: 0.145 * bass.deep * intensity,
    mid: 0.13 * bass.mid * intensity,
  }
  const maxBoost = Math.max(0, gains.sub, gains.deep, gains.mid, ...bands)
  const trim = settings.headroom ? Math.min(11, maxBoost * 0.42) : 0
  const activeName = activePreset?.name ?? 'Custom curve'

  const sweep = async () => {
    if (!supported) {
      toast('Web Audio is unavailable in this browser.', 'warn')
      return
    }
    const ok = await activate()
    if (!ok) {
      toast('Audio is blocked. Tap the screen once, then try again.', 'warn')
      return
    }
    if (sweeping) {
      engine.stopTestTone()
      setSweeping(false)
      toast('Sweep stopped')
      return
    }
    await engine.playTestTone()
    setSweeping(true)
    toast('32–110 Hz sweep through the active chain', 'success')
    if (sweepTimer.current) window.clearTimeout(sweepTimer.current)
    sweepTimer.current = window.setTimeout(() => setSweeping(false), 8400)
  }

  const submitPreset = () => {
    const created = saveCurrentPreset(name)
    if (created) {
      setSaveOpen(false)
      setName('')
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Tone shaping"
        title={
          <>
            Frequency <span className="text-gradient">engine</span>
          </>
        }
        subtitle="Eighteen parametric bands, a dedicated bass contour, and automatic headroom. Drag the curve or the faders."
        action={
          <div className="header-actions">
            <button type="button" className="ghost-btn" onClick={resetEq}>
              <RotateCcw size={15} /> Reset
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setName(activePreset?.builtin ? `${activePreset.name} Edit` : '')
                setSaveOpen(true)
              }}
            >
              <BookmarkPlus size={16} /> Save preset
            </button>
          </div>
        }
      />

      <div className="eq-active reveal">
        <div className="eq-active__copy">
          <p className="eyebrow">Active sound</p>
          <strong>{activeName}</strong>
          <span>
            {Math.round(bass.intensity)}% drive · {presets.length} presets available
          </span>
        </div>
        <div className="eq-active__meta">
          <span>
            Peak boost <strong>{maxBoost.toFixed(1)} dB</strong>
          </span>
          <span>
            Headroom <strong>{settings.headroom ? `−${trim.toFixed(1)} dB` : 'off'}</strong>
          </span>
        </div>
      </div>

      <section className="panel curve-panel reveal">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Parametric EQ</p>
            <h2>Response curve</h2>
          </div>
          <Segmented
            label="Frequency range"
            compact
            value={focus}
            onChange={setFocus}
            options={[
              { value: 'full', label: '20 Hz – 20 kHz' },
              { value: 'bass', label: 'Bass focus' },
            ]}
          />
        </div>
        <FrequencyCurve bands={bands} onChange={setBand} />
        <p className="panel-hint">
          Drag any node to adjust that band. Double-tap a node to return it to 0 dB.
          {focus === 'bass' && ' Bass focus isolates 20 Hz – 400 Hz for surgical low-end work.'}
        </p>
      </section>

      <section className="panel bands-panel reveal reveal--delay-1">
        <div className="panel-head">
          <div>
            <p className="eyebrow">18-band graphic</p>
            <h2>Band gain</h2>
          </div>
          <span className="chip">±12 dB · 0.5 dB steps</span>
        </div>
        <EqSliders bands={bands} onBandChange={setBand} bassFocus={focus === 'bass'} />
        <p className="panel-hint">Double-tap a fader to reset that band. Changes apply instantly.</p>
      </section>

      <section className="panel bass-panel reveal reveal--delay-2">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Low frequency engine</p>
            <h2>Bass contour</h2>
          </div>
          <span className="chip">
            <Waves size={12} /> Low shelf + 2 bells
          </span>
        </div>

        <div className="bass-engine-grid">
          <div className="bass-controls">
            <RangeControl
              label="Bass intensity"
              value={bass.intensity}
              min={0}
              max={100}
              onChange={(value) => updateBass({ intensity: value })}
              format={(v) => `${Math.round(v)}%`}
              hint="The master boost multiplier. Also available as the dashboard knob."
            />
            <div className="bass-controls__pair">
              <RangeControl
                label="Sub-bass"
                value={bass.sub}
                min={0}
                max={100}
                onChange={(value) => updateBass({ sub: value })}
                format={(v) => signedDb(0.16 * v * intensity)}
                hint="32 Hz low shelf"
              />
              <RangeControl
                label="Deep bass"
                value={bass.deep}
                min={0}
                max={100}
                onChange={(value) => updateBass({ deep: value })}
                format={(v) => signedDb(0.145 * v * intensity)}
                hint="70 Hz bell"
              />
              <RangeControl
                label="Mid-bass"
                value={bass.mid}
                min={0}
                max={100}
                onChange={(value) => updateBass({ mid: value })}
                format={(v) => signedDb(0.13 * v * intensity)}
                hint="140 Hz bell"
              />
              <RangeControl
                label="Overall gain"
                value={bass.gain}
                min={-9}
                max={9}
                step={0.5}
                onChange={(value) => updateBass({ gain: value })}
                format={signedDb}
                hint="Pre-amp trim"
              />
              <RangeControl
                label="Output level"
                value={bass.output}
                min={0}
                max={100}
                onChange={(value) => updateBass({ output: value })}
                format={(v) => `${Math.round(v)}%`}
                hint="Post-limiter level"
              />
            </div>
          </div>

          <aside className="signal-side">
            <div className="signal-card">
              <div className="signal-card__head">
                <ShieldCheck size={16} />
                <span>Headroom protection</span>
                <b className={settings.headroom ? 'is-on' : ''}>
                  {settings.headroom ? 'ON' : 'OFF'}
                </b>
              </div>
              <p>
                Predicted peak boost <strong>{maxBoost.toFixed(1)} dB</strong>. Automatic
                pre-gain trim <strong>−{trim.toFixed(1)} dB</strong> plus a final
                brick-wall limiter.
              </p>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (maxBoost / 18) * 100)}%` }} />
              </div>
              <div className="meter-labels">
                <span>Clean</span>
                <span>Limit</span>
              </div>
            </div>

            <div className="signal-path" aria-label="Signal path">
              <p className="eyebrow">Signal path</p>
              <ol>
                <li>
                  <span>Input</span>
                  <b>{supported ? 'Web Audio' : 'Unavailable'}</b>
                </li>
                <li>
                  <span>Sub shelf</span>
                  <b>32 Hz</b>
                </li>
                <li>
                  <span>Deep bell</span>
                  <b>70 Hz</b>
                </li>
                <li>
                  <span>Mid bell</span>
                  <b>140 Hz</b>
                </li>
                <li>
                  <span>Parametric</span>
                  <b>18 bands</b>
                </li>
                <li>
                  <span>Dynamics</span>
                  <b>Sat + limiter</b>
                </li>
              </ol>
            </div>

            <button type="button" className="ghost-btn ghost-btn--wide" onClick={() => void sweep()}>
              <Waves size={16} />
              {sweeping ? 'Stop sweep' : 'Play test sweep'}
            </button>
            <p className="signal-side__note">
              A real 32–110 Hz tone routed through the current filters. Safe for
              headphones at normal volume.
            </p>
          </aside>
        </div>
      </section>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        eyebrow="Custom preset"
        title="Capture this sound"
        footer={
          <>
            <button type="button" className="ghost-btn" onClick={() => setSaveOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={submitPreset}>
              Save preset
            </button>
          </>
        }
      >
        <label className="field">
          <span>Preset name</span>
          <input
            value={name}
            maxLength={32}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Midnight Drive"
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitPreset()
            }}
          />
        </label>
        <p className="field-hint">
          Saves your current bass contour and all 18 equalizer bands. You can rename
          or update it later from Presets.
        </p>
      </Modal>
    </div>
  )
}
