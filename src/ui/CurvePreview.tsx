import { useId } from 'react'
import { bandPoints, areaPath, smoothPath } from '../lib/curve'

export function CurvePreview({
  bands,
  height = 54,
  className = '',
}: {
  bands: number[]
  height?: number
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const width = 180
  const points = bandPoints(bands, width, height, 4, 7)
  return (
    <svg
      className={`curve-preview ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-bright)" />
          <stop offset="55%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--cyan)" />
        </linearGradient>
        <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath(points, height / 2)} fill={`url(#${uid}-area)`} />
      <line
        x1="0"
        x2={width}
        y1={height / 2}
        y2={height / 2}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />
      <path
        d={smoothPath(points)}
        fill="none"
        stroke={`url(#${uid}-line)`}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
