import { useState } from 'react'
import {
  Check,
  Headphones,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useApp } from '../state/AppProvider'
import type { Preset } from '../audio/types'
import { CurvePreview } from '../ui/CurvePreview'
import { Modal } from '../ui/Modal'
import { PageHeader, SectionTitle } from '../ui/PageHeader'
import { signedDb } from '../lib/platform'

type Confirm = { kind: 'preset' | 'profile'; id: string; name: string }

export function PresetsPage() {
  const {
    presets,
    customPresets,
    activePresetId,
    activePreset,
    activeProfile,
    activeProfileId,
    applyPreset,
    saveCurrentPreset,
    updateCustomPreset,
    deleteCustomPreset,
    profiles,
    applyProfile,
    saveCurrentProfile,
    deleteCustomProfile,
    bands,
    bass,
  } = useApp()

  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileDesc, setProfileDesc] = useState('')
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  const signature = presets.filter((p) => p.builtin)
  const activeName = activePreset?.name ?? (activeProfile ? `${activeProfile.name} tuning` : 'Custom curve')

  const submitSave = () => {
    const created = saveCurrentPreset(name)
    if (created) {
      setSaveOpen(false)
      setName('')
    }
  }

  const submitRename = () => {
    if (!rename) return
    const trimmed = rename.name.trim()
    if (trimmed) updateCustomPreset(rename.id, { name: trimmed.slice(0, 32) })
    setRename(null)
  }

  const submitProfile = () => {
    saveCurrentProfile(profileName, profileDesc)
    setProfileOpen(false)
    setProfileName('')
    setProfileDesc('')
  }

  const runDelete = () => {
    if (!confirm) return
    if (confirm.kind === 'preset') deleteCustomPreset(confirm.id)
    else deleteCustomProfile(confirm.id)
    setConfirm(null)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Sound library"
        title={
          <>
            Signature <span className="text-gradient">presets</span>
          </>
        }
        subtitle="Twelve curated profiles, your own captures, and headphone-specific tunings — all applied instantly to the engine."
        action={
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              setName('')
              setSaveOpen(true)
            }}
          >
            <Plus size={16} /> Save current
          </button>
        }
      />

      <section className="panel active-sound reveal">
        <div className="active-sound__curve">
          <CurvePreview bands={bands} height={82} />
        </div>
        <div className="active-sound__copy">
          <p className="eyebrow">Active sound</p>
          <h2>{activeName}</h2>
          <p>
            {activePreset?.tagline ??
              (activeProfile
                ? activeProfile.description
                : 'A custom contour built in the equalizer.')}
          </p>
        </div>
        <div className="active-sound__stats">
          <div>
            <span>Drive</span>
            <strong>{Math.round(bass.intensity)}%</strong>
          </div>
          <div>
            <span>Bass peak</span>
            <strong>{signedDb(0.16 * bass.sub * (bass.intensity / 100))}</strong>
          </div>
          <div>
            <span>Saved</span>
            <strong>{presets.length}</strong>
          </div>
        </div>
      </section>

      <SectionTitle
        title="Signature collection"
        hint="Tap a card to engage it. Built-in profiles are read-only."
        action={<span className="chip">{signature.length} curated</span>}
      />

      <div className="preset-grid reveal reveal--delay-1">
        {signature.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            active={activePresetId === preset.id}
            onApply={() => applyPreset(preset)}
          />
        ))}
      </div>

      <SectionTitle
        title="Your presets"
        hint="Captured from the equalizer. Rename, refresh or delete anytime."
        action={
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setName('')
              setSaveOpen(true)
            }}
          >
            <Plus size={15} /> New preset
          </button>
        }
      />

      {customPresets.length === 0 ? (
        <div className="empty-card reveal">
          <Sparkles size={22} />
          <div>
            <strong>No custom presets yet</strong>
            <p>
              Shape a curve on the equalizer, then save it here. Your presets are
              stored on this device and survive refreshes.
            </p>
          </div>
        </div>
      ) : (
        <div className="preset-grid reveal reveal--delay-1">
          {customPresets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              active={activePresetId === preset.id}
              onApply={() => applyPreset(preset)}
              onRename={() => setRename({ id: preset.id, name: preset.name })}
              onUpdate={() =>
                updateCustomPreset(preset.id, {
                  bass: { ...bass },
                  bands: [...bands],
                  tagline: 'Updated custom profile',
                })
              }
              onDelete={() =>
                setConfirm({ kind: 'preset', id: preset.id, name: preset.name })
              }
            />
          ))}
        </div>
      )}

      <SectionTitle
        title="Headphone profiles"
        hint="Manual calibration for the gear you actually use."
        action={
          <button type="button" className="ghost-btn" onClick={() => setProfileOpen(true)}>
            <Plus size={15} /> Save profile
          </button>
        }
      />

      <div className="notice notice--info reveal">
        <Headphones size={17} />
        <p>
          BASSX does not auto-detect your headphones or claim to. Pick a profile
          to apply a tuning that suits that device — or create a custom one from
          your current sound.
        </p>
      </div>

      <div className="profile-grid reveal reveal--delay-1">
        {profiles.map((profile) => (
          <article
            key={profile.id}
            className={`profile-card panel ${activeProfileId === profile.id ? 'is-active' : ''}`}
          >
            <button
              type="button"
              className="profile-card__hit"
              onClick={() => applyProfile(profile)}
            >
              <span className="profile-card__icon">
                <Headphones size={18} />
              </span>
              <span className="profile-card__body">
                <span className="profile-card__title">
                  {profile.name}
                  {activeProfileId === profile.id && <Check size={14} />}
                </span>
                <span className="profile-card__desc">{profile.description}</span>
              </span>
              <span className="profile-card__curve">
                <CurvePreview bands={profile.bands} height={34} />
              </span>
            </button>
            {!profile.builtin && (
              <button
                type="button"
                className="icon-btn icon-btn--ghost profile-card__delete"
                aria-label={`Delete ${profile.name} profile`}
                onClick={() =>
                  setConfirm({ kind: 'profile', id: profile.id, name: profile.name })
                }
              >
                <Trash2 size={14} />
              </button>
            )}
          </article>
        ))}
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        eyebrow="Custom preset"
        title="Save the current sound"
        footer={
          <>
            <button type="button" className="ghost-btn" onClick={() => setSaveOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={submitSave}>
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
            placeholder="e.g. Night Drive"
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitSave()
            }}
          />
        </label>
        <p className="field-hint">
          Captures all 18 EQ bands, the bass contour and the output trim.
        </p>
      </Modal>

      <Modal
        open={Boolean(rename)}
        onClose={() => setRename(null)}
        eyebrow="Rename"
        title="Edit preset name"
        footer={
          <>
            <button type="button" className="ghost-btn" onClick={() => setRename(null)}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={submitRename}>
              Save name
            </button>
          </>
        }
      >
        <label className="field">
          <span>Name</span>
          <input
            value={rename?.name ?? ''}
            maxLength={32}
            onChange={(event) =>
              setRename((prev) => (prev ? { ...prev, name: event.target.value } : prev))
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitRename()
            }}
          />
        </label>
      </Modal>

      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        eyebrow="Headphone profile"
        title="Tune for your gear"
        footer={
          <>
            <button type="button" className="ghost-btn" onClick={() => setProfileOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={submitProfile}>
              Save profile
            </button>
          </>
        }
      >
        <label className="field">
          <span>Headphones or earbuds</span>
          <input
            value={profileName}
            maxLength={32}
            onChange={(event) => setProfileName(event.target.value)}
            placeholder="e.g. AirPods Pro 2"
          />
        </label>
        <label className="field">
          <span>Short note</span>
          <input
            value={profileDesc}
            maxLength={90}
            onChange={(event) => setProfileDesc(event.target.value)}
            placeholder="e.g. Extra sub, softer treble"
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitProfile()
            }}
          />
        </label>
        <p className="field-hint">
          The current EQ curve and bass contour are saved to this profile. BASSX
          never claims automatic device detection.
        </p>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        eyebrow="Confirm"
        title={`Delete ${confirm?.name ?? ''}?`}
        footer={
          <>
            <button type="button" className="ghost-btn" onClick={() => setConfirm(null)}>
              Keep it
            </button>
            <button type="button" className="primary-btn primary-btn--danger" onClick={runDelete}>
              Delete
            </button>
          </>
        }
      >
        <p className="modal-copy">
          This removes the {confirm?.kind === 'profile' ? 'headphone profile' : 'preset'} from
          this device. Built-in sounds are never affected.
        </p>
      </Modal>
    </div>
  )
}

function PresetCard({
  preset,
  active,
  onApply,
  onRename,
  onUpdate,
  onDelete,
}: {
  preset: Preset
  active: boolean
  onApply: () => void
  onRename?: () => void
  onUpdate?: () => void
  onDelete?: () => void
}) {
  const peak = Math.max(0, ...preset.bands)
  return (
    <article className={`preset-card panel ${active ? 'is-active' : ''}`}>
      <button type="button" className="preset-card__hit" onClick={onApply}>
        <div className="preset-card__top">
          <span className="preset-card__tag">
            {preset.builtin ? 'Signature' : 'Custom'}
          </span>
          {active && (
            <span className="preset-card__check">
              <Check size={11} /> Active
            </span>
          )}
        </div>
        <h3>{preset.name}</h3>
        <p>{preset.tagline}</p>
        <div className="preset-card__curve">
          <CurvePreview bands={preset.bands} height={58} />
        </div>
        <div className="preset-card__foot">
          <span>{Math.round(preset.bass.intensity)}% drive</span>
          <span>{peak > 0 ? `+${peak.toFixed(1)} dB peak` : 'Flat'}</span>
        </div>
      </button>
      {!preset.builtin && (
        <div className="preset-card__actions">
          <button
            type="button"
            className="icon-btn icon-btn--ghost"
            onClick={onRename}
            aria-label={`Rename ${preset.name}`}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--ghost"
            onClick={onUpdate}
            aria-label={`Update ${preset.name} with current sound`}
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--ghost icon-btn--danger"
            onClick={onDelete}
            aria-label={`Delete ${preset.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </article>
  )
}
