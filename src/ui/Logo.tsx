import { Link } from 'react-router-dom'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="logo" aria-label="BASSX home">
      <span className="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 28 28" width="22" height="22">
          <rect x="2" y="12" width="3" height="8" rx="1.5" fill="currentColor" />
          <rect x="7.5" y="8" width="3" height="16" rx="1.5" fill="currentColor" />
          <rect x="13" y="4" width="3" height="24" rx="1.5" fill="currentColor" />
          <rect x="18.5" y="8" width="3" height="16" rx="1.5" fill="currentColor" />
          <rect x="24" y="12" width="3" height="8" rx="1.5" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className="logo__word">
          BASS<span>X</span>
        </span>
      )}
    </Link>
  )
}
