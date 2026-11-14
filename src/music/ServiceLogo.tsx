import { useId } from 'react'
import type { ServiceId } from './types'

/**
 * Inline brand marks.
 *
 * These are simplified, hand-drawn marks used to identify the service in the
 * UI. They are not hotlinked from a third-party CDN, so the app keeps working
 * offline and no external logo request leaks the user's presence.
 */
export function ServiceLogo({
  service,
  size = 42,
  className = '',
}: {
  service: ServiceId
  size?: number
  className?: string
}) {
  const rawId = useId()
  const id = `svc${rawId.replace(/[^a-zA-Z0-9]/g, '')}`

  const common = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    className: `service-logo ${className}`,
    role: 'img' as const,
    'aria-hidden': true,
  }

  switch (service) {
    case 'spotify':
      return (
        <svg {...common} aria-label="Spotify">
          <circle cx="24" cy="24" r="23" fill="#1ed760" />
          <path
            d="M13.2 18.6c6.8-2 14.6-1.1 21 2.9"
            stroke="#05140a"
            strokeWidth="3.1"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M15.1 25.1c5.6-1.6 12-.8 17.2 2.4"
            stroke="#05140a"
            strokeWidth="2.7"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M17 31.2c4.4-1.2 9.4-.6 13.5 1.9"
            stroke="#05140a"
            strokeWidth="2.3"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )

    case 'appleMusic':
      return (
        <svg {...common} aria-label="Apple Music">
          <defs>
            <linearGradient id={`${id}-am`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb5c74" />
              <stop offset="100%" stopColor="#fa233b" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="44" height="44" rx="11" fill={`url(#${id}-am)`} />
          <path
            d="M20.7 32.1V17.4l11.4-2.7v14.1"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <ellipse cx="17.8" cy="32.6" rx="3.6" ry="3" fill="#fff" />
          <ellipse cx="29.2" cy="29.6" rx="3.6" ry="3" fill="#fff" />
        </svg>
      )

    case 'youtubeMusic':
      return (
        <svg {...common} aria-label="YouTube Music">
          <circle cx="24" cy="24" r="23" fill="#ff0033" />
          <circle cx="24" cy="24" r="12.2" stroke="#fff" strokeWidth="2.6" fill="none" />
          <path d="M21.1 17.6 32 24l-10.9 6.4Z" fill="#fff" />
        </svg>
      )

    case 'soundcloud':
      return (
        <svg {...common} aria-label="SoundCloud">
          <rect x="2" y="2" width="44" height="44" rx="11" fill="#1a0c05" />
          <path
            d="M8.4 30.9h26.8a5.6 5.6 0 0 0 .4-11.2 9 9 0 0 0-16.3-2.3 5.2 5.2 0 0 0-3-.9 5.4 5.4 0 0 0-5.4 5.3c0 .4 0 .7.1 1.1a4.4 4.4 0 0 0-2.6 4 4.1 4.1 0 0 0 0 4Z"
            fill="#ff5500"
          />
          <path
            d="M12 21.5v9.2M15.4 20.6v10.1M18.8 20.2v10.5"
            stroke="#1a0c05"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )

    case 'tidal':
      return (
        <svg {...common} aria-label="Tidal">
          <rect x="2" y="2" width="44" height="44" rx="11" fill="#05070b" />
          <path d="M15 18.5 20.5 13 26 18.5 20.5 24Z" fill="#00d3ff" />
          <path d="M22.5 18.5 28 13l5.5 5.5L28 24Z" fill="#00d3ff" />
          <path d="M15.5 26 21 20.5 26.5 26 21 31.5Z" fill="#00d3ff" opacity="0.8" />
          <path d="M23 26 28.5 20.5 34 26l-5.5 5.5Z" fill="#00d3ff" opacity="0.8" />
        </svg>
      )

    case 'deezer':
      return (
        <svg {...common} aria-label="Deezer">
          <rect x="2" y="2" width="44" height="44" rx="11" fill="#12071d" />
          <g fill="#a238ff">
            <rect x="9" y="15" width="6" height="4.4" rx="1" />
            <rect x="17" y="15" width="6" height="4.4" rx="1" />
            <rect x="25" y="15" width="6" height="4.4" rx="1" />
            <rect x="33" y="15" width="6" height="4.4" rx="1" />
            <rect x="9" y="21.8" width="6" height="4.4" rx="1" />
            <rect x="17" y="21.8" width="6" height="4.4" rx="1" />
            <rect x="25" y="21.8" width="6" height="4.4" rx="1" />
            <rect x="17" y="28.6" width="6" height="4.4" rx="1" />
            <rect x="25" y="28.6" width="6" height="4.4" rx="1" />
            <rect x="33" y="28.6" width="6" height="4.4" rx="1" />
          </g>
        </svg>
      )

    case 'amazonMusic':
      return (
        <svg {...common} aria-label="Amazon Music">
          <rect x="2" y="2" width="44" height="44" rx="11" fill="#0b1a1c" />
          <path
            d="M11.5 22.5c0-5.4 5.6-9.4 12.5-9.4s12.5 4 12.5 9.4"
            stroke="#25d1da"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M12 28c3.2 5.4 8.4 8 12 8s8.8-2.6 12-8"
            stroke="#25d1da"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="24" cy="23" r="3.2" fill="#25d1da" />
        </svg>
      )

    default:
      return null
  }
}
