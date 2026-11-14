import { Link, useLocation } from 'react-router-dom'
import { Pause, Play, SkipForward } from 'lucide-react'
import { usePlayer } from '../player/PlayerProvider'

export function MiniPlayer() {
  const location = useLocation()
  const { currentTrack, isPlaying, togglePlay, next, time, duration } = usePlayer()

  if (!currentTrack || location.pathname === '/player') return null
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0

  return (
    <div className="mini-player">
      <div className="mini-player__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <Link to="/player" className="mini-player__main">
        <span className={`mini-player__art ${isPlaying ? 'is-playing' : ''}`}>
          {currentTrack.artworkUrl ? (
            <img src={currentTrack.artworkUrl} alt="" />
          ) : (
            <span className="mini-player__art-fallback">BX</span>
          )}
        </span>
        <span className="mini-player__meta">
          <span className="mini-player__title">{currentTrack.title}</span>
          <span className="mini-player__artist">{currentTrack.artist}</span>
        </span>
      </Link>
      <div className="mini-player__controls">
        <button
          type="button"
          className="icon-btn icon-btn--ghost"
          onClick={() => void togglePlay()}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--ghost"
          onClick={next}
          aria-label="Next track"
        >
          <SkipForward size={18} />
        </button>
      </div>
    </div>
  )
}
