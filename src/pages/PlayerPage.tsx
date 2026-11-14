import { useRef, useState, type CSSProperties, type DragEvent } from 'react'
import {
  Info,
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  UploadCloud,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useApp } from '../state/AppProvider'
import { usePlayer } from '../player/PlayerProvider'
import { formatTime } from '../audio/types'
import { SpectrumCanvas } from '../ui/SpectrumCanvas'
import { PageHeader } from '../ui/PageHeader'

export function PlayerPage() {
  const {
    tracks,
    currentTrack,
    isPlaying,
    isLoading,
    error,
    time,
    duration,
    addFiles,
    removeTrack,
    playTrack,
    togglePlay,
    next,
    previous,
    seek,
  } = usePlayer()
  const { volume, setVolume, repeat, setRepeat, shuffle, toggleShuffle } = useApp()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const progress = duration > 0 ? (time / duration) * 100 : 0
  const canSeek = duration > 0 && Number.isFinite(duration)

  const cycleRepeat = () => {
    setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')
  }

  const handleFiles = (files: FileList | File[]) => {
    void addFiles(files)
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragOver(false)
    if (event.dataTransfer.files?.length) handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="The deck"
        title={
          <>
            Your sound, <span className="text-gradient">live.</span>
          </>
        }
        subtitle="Open music from your device. Every track runs through the BASSX engine before it hits your speakers."
        action={
          <button
            type="button"
            className="primary-btn"
            onClick={() => inputRef.current?.click()}
          >
            <Plus size={16} /> Add music
          </button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg,.opus,.aac"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) handleFiles(event.target.files)
          event.target.value = ''
        }}
      />

      <div className="player-grid">
        <section className="panel deck-panel reveal">
          <div className="deck-art-wrap">
            <div className={`deck-art ${isPlaying ? 'is-playing' : ''}`}>
              {currentTrack?.artworkUrl ? (
                <img src={currentTrack.artworkUrl} alt="" />
              ) : (
                <div className="deck-art__fallback">
                  <Music2 size={64} strokeWidth={1} />
                  <span>{currentTrack?.title ?? 'BASSX'}</span>
                </div>
              )}
              <span className="deck-art__sheen" aria-hidden="true" />
            </div>
            <span className={`deck-state ${isPlaying ? 'is-live' : ''}`}>
              <span /> {isPlaying ? 'Processing live' : 'Engine ready'}
            </span>
          </div>

          <div className="deck-meta">
            <p className="eyebrow">{currentTrack?.album ?? 'No track loaded'}</p>
            <h2>{currentTrack?.title ?? 'Choose a track'}</h2>
            <p>{currentTrack?.artist ?? 'BASSX has a demo ready to play'}</p>
          </div>

          <SpectrumCanvas height={92} bars={48} showGrid={false} className="deck-spectrum" />

          <div className="seek">
            <input
              type="range"
              className="slider slider--seek"
              min={0}
              max={canSeek ? duration : 1}
              step={0.1}
              value={canSeek ? Math.min(time, duration) : 0}
              disabled={!canSeek}
              onChange={(event) => seek(Number(event.target.value))}
              style={{ '--pct': `${progress}%` } as CSSProperties}
              aria-label="Seek"
            />
            <div className="seek__times">
              <span>{formatTime(time)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="transport">
            <button
              type="button"
              className={`transport__btn ${shuffle ? 'is-active' : ''}`}
              onClick={toggleShuffle}
              aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
              aria-pressed={shuffle}
            >
              <Shuffle size={18} />
            </button>
            <button
              type="button"
              className="transport__btn"
              onClick={previous}
              aria-label="Previous track"
            >
              <SkipBack size={22} />
            </button>
            <button
              type="button"
              className="play-btn"
              onClick={() => void togglePlay()}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 size={26} className="spin" />
              ) : isPlaying ? (
                <Pause size={26} fill="currentColor" />
              ) : (
                <Play size={26} fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              className="transport__btn"
              onClick={next}
              aria-label="Next track"
            >
              <SkipForward size={22} />
            </button>
            <button
              type="button"
              className={`transport__btn ${repeat !== 'off' ? 'is-active' : ''}`}
              onClick={cycleRepeat}
              aria-label={`Repeat ${repeat}`}
            >
              {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              {repeat !== 'off' && <span className="transport__badge">{repeat === 'one' ? '1' : '∞'}</span>}
            </button>
          </div>

          <div className="volume-row">
            <button
              type="button"
              className="icon-btn icon-btn--ghost"
              onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
              aria-label={volume > 0 ? 'Mute' : 'Unmute'}
            >
              {volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <input
              type="range"
              className="slider slider--thin"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              style={{ '--pct': `${volume * 100}%` } as CSSProperties}
              aria-label="Volume"
            />
            <span className="volume-row__value">{Math.round(volume * 100)}</span>
          </div>

          {error && (
            <div className="notice notice--warn">
              <Info size={16} />
              <p>{error}</p>
            </div>
          )}
        </section>

        <section
          className={`panel library-panel reveal reveal--delay-1 ${dragOver ? 'is-drag' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="panel-head">
            <div>
              <p className="eyebrow">On this device</p>
              <h2>Library</h2>
            </div>
            <span className="chip">
              <ListMusic size={12} /> {tracks.length} track{tracks.length === 1 ? '' : 's'}
            </span>
          </div>

          <button
            type="button"
            className="dropzone"
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud size={20} />
            <span>
              <strong>Drop audio here</strong> or browse files
            </span>
            <small>MP3 · M4A · WAV · FLAC · OGG · OPUS</small>
          </button>

          <div className="track-list">
            {tracks.map((track, index) => {
              const isCurrent = currentTrack?.id === track.id
              return (
                <div key={track.id} className={`track-row ${isCurrent ? 'is-current' : ''}`}>
                  <button
                    type="button"
                    className="track-row__main"
                    onClick={() => playTrack(track.id)}
                  >
                    <span className="track-row__art">
                      {track.artworkUrl ? (
                        <img src={track.artworkUrl} alt="" />
                      ) : (
                        <Music2 size={16} />
                      )}
                    </span>
                    <span className="track-row__meta">
                      <span className="track-row__title">{track.title}</span>
                      <span className="track-row__artist">
                        {track.artist}
                        {track.isDemo && ' · demo'}
                      </span>
                    </span>
                    {isCurrent && isPlaying ? (
                      <span className="playing-bars" aria-label="Playing">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      <span className="track-row__num">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    )}
                  </button>
                  {!track.isDemo && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--ghost track-row__remove"
                      onClick={() => removeTrack(track.id)}
                      aria-label={`Remove ${track.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <p className="library-note">
            <Info size={14} />
            Files stay on your device — nothing is uploaded. Both the demo and
            local tracks are processed in real time through the Web Audio graph.
          </p>
        </section>
      </div>
    </div>
  )
}
