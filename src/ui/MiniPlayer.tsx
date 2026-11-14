import { Link, useLocation } from 'react-router-dom'
import { Lock, Pause, Play, SkipForward } from 'lucide-react'
import { useUnifiedPlayback } from '../music/useUnifiedPlayback'

export function MiniPlayer() {
  const location = useLocation()
  const {
    hasTrack,
    title,
    artist,
    artworkUrl,
    isPlaying,
    togglePlay,
    next,
    canNext,
    position,
    duration,
    providerActive,
    serviceName,
  } = useUnifiedPlayback()

  if (!hasTrack || location.pathname === '/player') return null
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  return (
    <div className={`mini-player ${providerActive ? 'is-provider' : ''}`}>
      <div className="mini-player__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <Link to="/player" className="mini-player__main">
        <span className={`mini-player__art ${isPlaying ? 'is-playing' : ''}`}>
          {artworkUrl ? (
            <img src={artworkUrl} alt="" />
          ) : (
            <span className="mini-player__art-fallback">BX</span>
          )}
        </span>
        <span className="mini-player__meta">
          <span className="mini-player__title">{title}</span>
          <span className="mini-player__artist">
            {artist}
            {providerActive ? ` · ${serviceName}` : ''}
          </span>
        </span>
      </Link>
      {providerActive && (
        <span className="mini-player__protected" title="Protected provider stream · BASSX DSP bypassed">
          <Lock size={11} /> DSP off
        </span>
      )}
      <div className="mini-player__controls">
        <button
          type="button"
          className="icon-btn icon-btn--ghost"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--ghost"
          onClick={next}
          disabled={!canNext}
          aria-label="Next track"
        >
          <SkipForward size={18} />
        </button>
      </div>
    </div>
  )
}
