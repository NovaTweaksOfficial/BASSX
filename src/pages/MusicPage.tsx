import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clipboard,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  Lock,
  Music2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Unplug,
} from 'lucide-react'
import { useMusic, type ConnectableService } from '../music/MusicProvider'
import { useUnifiedPlayback } from '../music/useUnifiedPlayback'
import {
  DSP_POLICY_NOTE,
  PRIMARY_SERVICES,
  SECONDARY_SERVICES,
  getService,
} from '../music/providers/registry'
import {
  LIBRARY_SECTIONS,
  type CapabilityName,
  type LibrarySection,
  type MusicItem,
  type ServiceDefinition,
  type ServiceId,
} from '../music/types'
import { ServiceLogo } from '../music/ServiceLogo'
import {
  getRedirectUri,
  loadAppleDeveloperToken,
  saveAppleDeveloperToken,
} from '../music/config'
import { Modal } from '../ui/Modal'
import { PageHeader, SectionTitle } from '../ui/PageHeader'
import { useToast } from '../ui/ToastProvider'
import { formatTime } from '../audio/types'

const CONNECTABLE: ConnectableService[] = ['spotify', 'appleMusic']

const CAPABILITY_LABELS: Record<CapabilityName, string> = {
  authorize: 'Sign-in',
  library: 'Library',
  metadata: 'Metadata',
  playback: 'Playback',
  search: 'Search',
  dsp: 'BASSX DSP',
}

const CAPABILITY_ORDER: CapabilityName[] = [
  'authorize',
  'library',
  'playback',
  'dsp',
]

function levelLabel(level: 'full' | 'limited' | 'none'): string {
  return level === 'full' ? 'Yes' : level === 'limited' ? 'Limited' : 'No'
}

function connectionTone(status?: string): string {
  if (status === 'connected') return 'is-live'
  if (status === 'connecting') return 'is-pending'
  if (status === 'reauth') return 'is-warn'
  if (status === 'error') return 'is-danger'
  return 'is-idle'
}

function statusLabel(service: ServiceDefinition, status?: string): string {
  if (service.availability === 'unavailable') return 'Unavailable'
  if (status === 'connected') return 'Connected'
  if (status === 'connecting') return 'Connecting'
  if (status === 'reauth') return 'Reconnect needed'
  if (status === 'error') return 'Needs attention'
  return 'Not connected'
}

export function MusicPage() {
  const music = useMusic()
  const { toast } = useToast()

  const [modalService, setModalService] = useState<ServiceId | null>(null)
  const [selected, setSelected] = useState<ConnectableService>(() =>
    music.connections.appleMusic.status === 'connected' ? 'appleMusic' : 'spotify',
  )
  const [section, setSection] = useState<LibrarySection>('recent')

  const connectedCount = CONNECTABLE.filter(
    (service) => music.connections[service].status === 'connected',
  ).length

  useEffect(() => {
    if (music.connections[selected].status === 'connected') return
    const other: ConnectableService =
      selected === 'spotify' ? 'appleMusic' : 'spotify'
    if (music.connections[other].status === 'connected') setSelected(other)
  }, [music.connections, selected])

  useEffect(() => {
    if (music.connections[selected].status !== 'connected') return
    const state = music.libraries[selected][section]
    if (state.status === 'idle') void music.refreshLibrary(selected, section)
  }, [music, section, selected])

  const library = music.libraries[selected]
  const sectionState = library[section]
  const selectedService = getService(selected)
  const selectedConnection = music.connections[selected]

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(getRedirectUri())
      toast('Redirect URI copied', 'success')
    } catch {
      toast('Copy failed — select the redirect URI manually.', 'warn')
    }
  }

  return (
    <div className="page music-page">
      <PageHeader
        eyebrow="Connected music"
        title={
          <>
            Every service. <span className="text-gradient">One hub.</span>
          </>
        }
        subtitle="Connect the services that publish official developer APIs, browse your real library, and play through each provider’s own player. BASSX never asks for a music-service password."
        action={
          <span className="chip chip--status">
            <span className={`status-dot ${connectedCount ? 'is-live' : ''}`} />
            {connectedCount
              ? `${connectedCount} connected`
              : 'Nothing connected'}
          </span>
        }
      />

      <NowPlayingCard />

      {connectedCount === 0 && (
        <div className="notice notice--info reveal">
          <ShieldCheck size={17} />
          <p>
            Setup is intentionally explicit: Spotify uses OAuth 2.0 with PKCE,
            and Apple Music uses its official sign-in through MusicKit. Tokens
            stay in this browser’s session storage unless you choose otherwise.
          </p>
        </div>
      )}

      <section className="music-services reveal">
        <SectionTitle
          title="Services"
          hint="Official APIs only. Where a provider does not permit web integration, BASSX says so instead of faking a connection."
        />
        <div className="service-grid">
          {PRIMARY_SERVICES.map((service) => {
            const connectable = CONNECTABLE.includes(service.id as ConnectableService)
            const connection = connectable
              ? music.connections[service.id as ConnectableService]
              : null
            const connected = connection?.status === 'connected'
            const connecting = connection?.status === 'connecting'
            const needsSetup =
              service.id === 'spotify'
                ? !music.config.spotifyClientId
                : service.id === 'appleMusic'
                  ? !music.config.appleTokenEndpoint && !loadAppleDeveloperToken()
                  : false
            const actionLabel = connecting
              ? 'Connecting'
              : service.availability === 'unavailable'
                ? 'Why not?'
                : connected
                  ? 'Manage'
                  : needsSetup
                    ? 'Set up'
                    : 'Connect'

            return (
              <article
                key={service.id}
                className={`service-card ${
                  connected ? 'is-connected' : ''
                } ${service.availability === 'unavailable' ? 'is-unavailable' : ''}`}
              >
                <div className="service-card__head">
                  <ServiceLogo service={service.id} size={44} />
                  <span className={`service-status ${connectionTone(connection?.status)}`}>
                    <i />
                    {statusLabel(service, connection?.status)}
                  </span>
                </div>
                <div className="service-card__body">
                  <h3>{service.name}</h3>
                  <p>{service.tagline}</p>
                  {connected && connection?.accountName && (
                    <span className="service-card__account">
                      {connection.accountName}
                    </span>
                  )}
                </div>
                <div className="service-card__caps">
                  <span
                    className={`cap-chip is-${service.capabilities.library}`}
                    title="Library access"
                  >
                    Library
                  </span>
                  <span
                    className={`cap-chip is-${service.capabilities.playback}`}
                    title="Playback support"
                  >
                    Playback
                  </span>
                  <span className="cap-chip is-off" title="BASSX DSP is not applied">
                    DSP off
                  </span>
                </div>
                <div className="service-card__actions">
                  <button
                    type="button"
                    className={`primary-btn primary-btn--compact ${
                      connected ? 'primary-btn--ghost' : ''
                    }`}
                    onClick={() => {
                      if (service.availability === 'unavailable' || connected || needsSetup) {
                        setModalService(service.id)
                        return
                      }
                      if (service.id === 'spotify') void music.connectSpotify()
                      if (service.id === 'appleMusic') void music.connectAppleMusic()
                    }}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <Loader2 size={14} className="spin" />
                    ) : connected ? (
                      <Link2 size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {actionLabel}
                  </button>
                  {connected && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--ghost"
                      aria-label={`Disconnect ${service.name}`}
                      onClick={() => void music.disconnect(service.id as ConnectableService)}
                      disabled={music.busyService === service.id}
                    >
                      <Unplug size={15} />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        <details className="secondary-services">
          <summary>
            Other services we researched
            <span>{SECONDARY_SERVICES.length}</span>
          </summary>
          <div className="service-list">
            {SECONDARY_SERVICES.map((service) => (
              <button
                key={service.id}
                type="button"
                className="service-row"
                onClick={() => setModalService(service.id)}
              >
                <ServiceLogo service={service.id} size={30} />
                <span className="service-row__text">
                  <strong>{service.name}</strong>
                  <small>{service.tagline}</small>
                </span>
                <span className="service-row__tag">Not supported</span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        </details>
      </section>

      <section className="panel music-library reveal">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Unified library</p>
            <h2>Your music</h2>
          </div>
          <div className="music-library__tools">
            {selectedConnection.status === 'connected' && (
              <button
                type="button"
                className="ghost-btn ghost-btn--compact"
                onClick={() => void music.refreshAll(selected)}
                disabled={sectionState.status === 'loading'}
              >
                <RefreshCw
                  size={14}
                  className={sectionState.status === 'loading' ? 'spin' : ''}
                />
                Refresh
              </button>
            )}
          </div>
        </div>

        <div className="library-service-tabs" role="tablist" aria-label="Music service">
          {CONNECTABLE.map((id) => {
            const service = getService(id)
            const connection = music.connections[id]
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected === id}
                className={`library-service-tab ${selected === id ? 'is-active' : ''}`}
                onClick={() => setSelected(id)}
                disabled={connection.status !== 'connected'}
                title={
                  connection.status === 'connected'
                    ? `Show ${service.name}`
                    : `${service.name} is not connected`
                }
              >
                <ServiceLogo service={id} size={20} />
                <span>{service.name}</span>
                <i className={`status-dot ${connectionTone(connection.status)}`} />
              </button>
            )
          })}
        </div>

        {selectedConnection.status !== 'connected' ? (
          <div className="music-empty">
            <span className="music-empty__icon">
              <ServiceLogo service={selected} size={52} />
            </span>
            <h3>Connect {selectedService.name} to load your library</h3>
            <p>
              BASSX asks {selectedService.name} directly for your saved music.
              Nothing is scraped, and your password never touches this app.
            </p>
            <button
              type="button"
              className="primary-btn primary-btn--compact"
              onClick={() => setModalService(selected)}
            >
              <Link2 size={14} /> Set up {selectedService.name}
            </button>
          </div>
        ) : (
          <>
            <div className="library-sections" role="tablist" aria-label="Library section">
              {LIBRARY_SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={section === item.id}
                  className={`library-section-tab ${
                    section === item.id ? 'is-active' : ''
                  }`}
                  onClick={() => setSection(item.id)}
                >
                  {item.label}
                  {library[item.id].status === 'ready' &&
                    library[item.id].items.length > 0 && (
                      <span>{library[item.id].items.length}</span>
                    )}
                </button>
              ))}
            </div>

            {music.sdkMessage && selected === 'spotify' && (
              <p className="music-sdk-note">
                <Info size={13} /> {music.sdkMessage}
              </p>
            )}

            {sectionState.status === 'loading' && sectionState.items.length === 0 && (
              <div className="music-grid" aria-label="Loading library">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="music-card music-card--skeleton">
                    <span className="music-card__art" />
                    <span className="skeleton-line" />
                    <span className="skeleton-line skeleton-line--short" />
                  </div>
                ))}
              </div>
            )}

            {sectionState.status === 'error' && (
              <div className="notice notice--warn">
                <AlertTriangle size={16} />
                <p>{sectionState.error}</p>
                <button
                  type="button"
                  className="ghost-btn ghost-btn--compact"
                  onClick={() => void music.refreshLibrary(selected, section)}
                >
                  Try again
                </button>
              </div>
            )}

            {sectionState.status !== 'error' &&
              sectionState.items.length === 0 &&
              sectionState.status === 'ready' && (
                <div className="music-empty music-empty--compact">
                  <span className="music-empty__icon">
                    <Music2 size={30} />
                  </span>
                  <h3>
                    {LIBRARY_SECTIONS.find((item) => item.id === section)?.emptyLabel}
                  </h3>
                  <p>
                    This section is empty in {selectedService.name}. Save or play
                    something there first, then refresh.
                  </p>
                </div>
              )}

            {sectionState.items.length > 0 && (
              <div className="music-grid">
                {sectionState.items.map((item) => (
                  <MusicCard
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onPlay={() => {
                      if (item.playable) {
                        void music.playItem(selected, item)
                      } else if (item.externalUrl) {
                        window.open(item.externalUrl, '_blank', 'noopener,noreferrer')
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {sectionState.updatedAt && (
              <p className="music-library__stamp">
                Updated {new Date(sectionState.updatedAt).toLocaleTimeString()}
              </p>
            )}
          </>
        )}
      </section>

      <div className="notice notice--info music-policy reveal">
        <Lock size={17} />
        <div>
          <strong>Protected audio stays protected</strong>
          <p>{DSP_POLICY_NOTE}</p>
          <Link to="/player" className="text-link">
            Process local audio with BASSX <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      <ServiceModal
        serviceId={modalService}
        onClose={() => setModalService(null)}
        copyRedirect={() => void copyRedirect()}
      />
    </div>
  )
}

function NowPlayingCard() {
  const unified = useUnifiedPlayback()

  if (!unified.providerActive) {
    return (
      <section className="panel music-now music-now--idle reveal">
        <span className="music-now__placeholder">
          <Music2 size={26} />
        </span>
        <div className="music-now__idle-copy">
          <p className="eyebrow">Unified player</p>
          <h2>No connected stream playing</h2>
          <p>
            Start something from your library below, or open the local deck to
            run audio through the BASSX engine.
          </p>
        </div>
        <Link to="/player" className="ghost-btn ghost-btn--compact">
          Open local deck <ArrowUpRight size={14} />
        </Link>
      </section>
    )
  }

  const progress =
    unified.duration > 0 ? Math.min(100, (unified.position / unified.duration) * 100) : 0
  const service = unified.service ? getService(unified.service) : null

  return (
    <section className="panel music-now reveal">
      <div className={`music-now__art ${unified.isPlaying ? 'is-playing' : ''}`}>
        {unified.artworkUrl ? (
          <img src={unified.artworkUrl} alt="" />
        ) : (
          <span>
            <Music2 size={26} />
          </span>
        )}
        <span className="music-now__service-logo">
          {service && <ServiceLogo service={service.id} size={24} />}
        </span>
      </div>
      <div className="music-now__body">
        <div className="music-now__meta-row">
          <span className="service-status is-live">
            <i /> {unified.serviceName}
          </span>
          <span className="music-now__protected">
            <Lock size={11} /> Protected stream · DSP bypassed
          </span>
        </div>
        <h2>{unified.title}</h2>
        <p className="music-now__artist">
          {unified.artist}
          {unified.album && unified.album !== unified.title
            ? ` · ${unified.album}`
            : ''}
        </p>
        <div className="music-now__seek">
          <input
            type="range"
            className="slider slider--seek"
            min={0}
            max={unified.duration || 1}
            step={0.1}
            value={Math.min(unified.position, unified.duration || 0)}
            disabled={!unified.canSeek}
            onChange={(event) => unified.seek(Number(event.target.value))}
            style={{ '--pct': `${progress}%` } as CSSProperties}
            aria-label="Seek connected playback"
          />
          <div className="seek__times">
            <span>{formatTime(unified.position)}</span>
            <span>{formatTime(unified.duration)}</span>
          </div>
        </div>
      </div>
      <div className="music-now__controls">
        <button
          type="button"
          className="icon-btn icon-btn--ghost"
          onClick={unified.previous}
          disabled={!unified.canPrevious}
          aria-label="Previous track"
        >
          <SkipBack size={18} />
        </button>
        <button
          type="button"
          className="play-btn play-btn--compact"
          onClick={unified.togglePlay}
          aria-label={unified.isPlaying ? 'Pause' : 'Play'}
        >
          {unified.isPlaying ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--ghost"
          onClick={unified.next}
          disabled={!unified.canNext}
          aria-label="Next track"
        >
          <SkipForward size={18} />
        </button>
        <button
          type="button"
          className="ghost-btn ghost-btn--compact music-now__local"
          onClick={() => unified.switchToLocal()}
        >
          Play local
        </button>
      </div>
    </section>
  )
}

function MusicCard({ item, onPlay }: { item: MusicItem; onPlay: () => void }) {
  return (
    <article className={`music-card music-card--${item.kind}`}>
      <button type="button" className="music-card__hit" onClick={onPlay}>
        <span className="music-card__art">
          {item.artworkUrl ? (
            <img src={item.artworkUrl} alt="" loading="lazy" />
          ) : (
            <Music2 size={22} />
          )}
          <span className="music-card__play">
            {item.playable ? (
              <Play size={16} fill="currentColor" />
            ) : (
              <ExternalLink size={15} />
            )}
          </span>
        </span>
        <span className="music-card__meta">
          <span className="music-card__title">{item.title}</span>
          <span className="music-card__subtitle">{item.subtitle}</span>
          <span className="music-card__detail">
            {item.kind === 'playlist' && item.trackCount != null
              ? `${item.trackCount} tracks`
              : item.kind === 'album' && item.trackCount != null
                ? `${item.trackCount} tracks`
                : item.kind === 'artist'
                  ? 'Artist'
                  : item.context ?? item.kind}
          </span>
        </span>
      </button>
      {item.externalUrl && (
        <a
          className="music-card__external"
          href={item.externalUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${item.title} in the provider app`}
        >
          <ExternalLink size={13} />
        </a>
      )}
    </article>
  )
}

function ServiceModal({
  serviceId,
  onClose,
  copyRedirect,
}: {
  serviceId: ServiceId | null
  onClose: () => void
  copyRedirect: () => void
}) {
  const music = useMusic()
  const { toast } = useToast()
  const service = serviceId ? getService(serviceId) : null
  const connectable =
    serviceId === 'spotify' || serviceId === 'appleMusic' ? serviceId : null
  const connection = connectable ? music.connections[connectable] : null

  const [clientId, setClientId] = useState('')
  const [remember, setRemember] = useState(false)
  const [endpoint, setEndpoint] = useState('')
  const [pastedToken, setPastedToken] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!serviceId) return
    setFormError(null)
    if (serviceId === 'spotify') {
      setClientId(music.config.spotifyClientId)
      setRemember(music.config.rememberSpotify)
    }
    if (serviceId === 'appleMusic') {
      setEndpoint(music.config.appleTokenEndpoint)
      setPastedToken('')
    }
  }, [serviceId, music.config])

  if (!service) return null

  const connected = connection?.status === 'connected'
  const busy = connectable != null && music.busyService === connectable
  const unavailable = service.availability === 'unavailable'

  const savePastedToken = () => {
    try {
      const token = music.validateAppleToken(pastedToken)
      saveAppleDeveloperToken(token)
      setPastedToken('')
      setFormError(null)
      // Nudge the provider so the service card re-reads the session token.
      music.updateConfig({})
      toast('Developer token saved for this session', 'success')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invalid token')
    }
  }

  const handleConnect = async () => {
    setFormError(null)
    if (serviceId === 'spotify') {
      const id = clientId.trim()
      if (!id) {
        setFormError('Enter your Spotify app Client ID.')
        return
      }
      if (!/^[0-9a-f]{32}$/i.test(id)) {
        setFormError(
          'That does not look like a Spotify Client ID. Copy the 32-character value from your app dashboard (no spaces).',
        )
        return
      }
      music.updateConfig({ spotifyClientId: id, rememberSpotify: remember })
      await music.connectSpotify(id)
      return
    }
    if (serviceId === 'appleMusic') {
      const url = endpoint.trim()
      if (url && !/^https?:\/\//i.test(url)) {
        setFormError('Enter a valid HTTPS token endpoint URL.')
        return
      }
      if (!url && !loadAppleDeveloperToken()) {
        setFormError(
          'Add a token endpoint, or paste a developer token for this session.',
        )
        return
      }
      const nextConfig = { ...music.config, appleTokenEndpoint: url }
      music.updateConfig({ appleTokenEndpoint: url })
      await music.connectAppleMusic(nextConfig)
    }
  }

  const redirectUri = getRedirectUri()

  return (
    <Modal
      open={Boolean(serviceId)}
      onClose={onClose}
      title={service.name}
      eyebrow="Connected music"
      size="md"
      footer={
        <>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
          {connected && connectable ? (
            <button
              type="button"
              className="ghost-btn ghost-btn--danger"
              onClick={() => {
                void music.disconnect(connectable)
                onClose()
              }}
              disabled={busy}
            >
              {busy ? <Loader2 size={15} className="spin" /> : <Unplug size={15} />}
              Disconnect
            </button>
          ) : !unavailable && connectable ? (
            <button
              type="button"
              className="primary-btn primary-btn--compact"
              onClick={() => void handleConnect()}
              disabled={busy}
            >
              {busy ? <Loader2 size={15} className="spin" /> : <Link2 size={15} />}
              {serviceId === 'appleMusic' ? 'Authorize Apple Music' : 'Connect Spotify'}
            </button>
          ) : null}
        </>
      }
    >
      <div className="service-modal">
        <div className="service-modal__hero">
          <ServiceLogo service={service.id} size={54} />
          <div>
            <p>{service.description}</p>
            <span className={`service-status ${connectionTone(connection?.status)}`}>
              <i />
              {statusLabel(service, connection?.status)}
            </span>
          </div>
        </div>

        {(connection?.error || formError) && (
          <div className="notice notice--warn">
            <AlertTriangle size={16} />
            <p>{formError ?? connection?.error}</p>
          </div>
        )}

        {unavailable && (
          <div className="notice notice--warn">
            <Info size={16} />
            <p>{service.availabilityReason}</p>
          </div>
        )}

        <div className="capability-grid">
          {CAPABILITY_ORDER.map((name) => (
            <div key={name} className={`capability capability--${service.capabilities[name]}`}>
              <span>{CAPABILITY_LABELS[name]}</span>
              <strong>{levelLabel(service.capabilities[name])}</strong>
            </div>
          ))}
        </div>

        <dl className="music-facts">
          <div>
            <dt>Authorization</dt>
            <dd>{service.authModel}</dd>
          </div>
          <div>
            <dt>Playback</dt>
            <dd>
              {service.capabilities.playback === 'none'
                ? 'Not available in a web app'
                : 'Provider player, with BASSX transport controls'}
            </dd>
          </div>
          <div>
            <dt>Audio processing</dt>
            <dd>Protected provider audio never enters the BASSX DSP graph.</dd>
          </div>
        </dl>

        {serviceId === 'spotify' && !connected && (
          <div className="service-setup">
            <div className="service-setup__head">
              <h4>Spotify app setup</h4>
              <a
                className="text-link"
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noreferrer"
              >
                Open dashboard <ArrowUpRight size={13} />
              </a>
            </div>
            <ol className="setup-steps">
              <li>Create an app in the Spotify developer dashboard.</li>
              <li>Add the redirect URI below to that app exactly.</li>
              <li>Copy the app’s Client ID here. It is public — never a secret.</li>
              <li>
                In Development Mode, add your Spotify account under
                <strong> Users and Access</strong> before connecting.
              </li>
            </ol>
            <label className="field">
              <span>Client ID</span>
              <input
                type="text"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>Redirect URI (must match Spotify exactly)</span>
              <span className="field__copy">
                <input type="text" value={redirectUri} readOnly />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={copyRedirect}
                  aria-label="Copy redirect URI"
                >
                  <Clipboard size={15} />
                </button>
              </span>
            </label>
            <label className="toggle-row toggle-row--boxed">
              <span className="toggle-row__text">
                <span className="toggle-row__label">Remember Spotify on this device</span>
                <span className="toggle-row__hint">
                  Off by default. When off, tokens are cleared when the browser
                  session ends.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={remember}
                aria-label="Remember Spotify on this device"
                className={`toggle ${remember ? 'is-on' : ''}`}
                onClick={() => setRemember((value) => !value)}
              >
                <span className="toggle__thumb" />
              </button>
            </label>
            <p className="setup-note">
              <ShieldCheck size={13} /> Playback inside BASSX requires Spotify
              Premium. BASSX never sees your Spotify password.
            </p>
          </div>
        )}

        {serviceId === 'appleMusic' && !connected && (
          <div className="service-setup">
            <div className="service-setup__head">
              <h4>MusicKit developer token</h4>
              <a
                className="text-link"
                href="https://developer.apple.com/documentation/apple_music_api"
                target="_blank"
                rel="noreferrer"
              >
                Apple docs <ArrowUpRight size={13} />
              </a>
            </div>
            <p className="setup-copy">
              Apple signs developer tokens with a private key. Keep that key on a
              server and point BASSX at an endpoint that returns
              <code>{' { "token": "…" } '}</code> or a plain JWT.
            </p>
            <label className="field">
              <span>Token endpoint</span>
              <input
                type="url"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="https://your-server.example/apple-music-token"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>…or paste a developer token for this session</span>
              <textarea
                value={pastedToken}
                onChange={(event) => setPastedToken(event.target.value)}
                placeholder="eyJhbGciOiJFUzI1NiIsImtpZCI6…"
                rows={3}
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="ghost-btn ghost-btn--compact"
              onClick={savePastedToken}
              disabled={!pastedToken.trim()}
            >
              <Check size={14} /> Validate &amp; use token
            </button>
            <p className="setup-note">
              <ShieldCheck size={13} /> BASSX checks the JWT expiry before use and
              stores it in session storage only. Never paste your Apple private
              key.
            </p>
          </div>
        )}

        {service.requirements.length > 0 && (
          <div className="service-requirements">
            <h4>Before you connect</h4>
            <ul>
              {service.requirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="service-limits">
          <h4>What to expect</h4>
          <ul>
            {service.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
          <a
            className="text-link"
            href={service.docsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Official developer documentation <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
    </Modal>
  )
}
