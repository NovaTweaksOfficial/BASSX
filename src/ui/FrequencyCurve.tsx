import { useId, useRef, useState, type PointerEvent } from 'react'
import { EQ_FREQUENCIES, formatHz } from '../audio/types'
import { areaPath, logRatio, nearestBandIndex, smoothPath, type Pt } from '../lib/curve'

const VIEW_W = 1000
const VIEW_H = 320
const PAD_L = 46
const PAD_R = 18
const PAD_T = 22
const PAD_B = 38
const RANGE = 12

type Props = {
  bands: number[]
  onChange: (index: number, gain: number) => void
  disabled?: boolean
}

export function FrequencyCurve({ bands, onChange, disabled }: Props) {
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const dragging = useRef(false)

  const plotW = VIEW_W - PAD_L - PAD_R
  const plotH = VIEW_H - PAD_T - PAD_B
  const center = PAD_T + plotH / 2

  const points: Pt[] = EQ_FREQUENCIES.map((hz, index) => ({
    x: PAD_L + logRatio(hz) * plotW,
    y: center - ((bands[index] ?? 0) / RANGE) * (plotH / 2),
  }))

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || disabled) return
    const rect = svg.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_H
    const ratio = (x - PAD_L) / plotW
    const index = nearestBandIndex(Math.max(0, Math.min(1, ratio)))
    const gain = ((center - y) / (plotH / 2)) * RANGE
    setActive(index)
    onChange(index, Math.max(-12, Math.min(12, Math.round(gain * 2) / 2)))
  }

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = true
    pick(event)
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) pick(event)
  }

  const finish = () => {
    dragging.current = false
  }

  const resetPoint = () => {
    if (active == null || disabled) return
    onChange(active, 0)
  }

  const activeBand = active != null ? bands[active] : null
  const hzTicks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]

  return (
    <div className={`frequency-curve ${disabled ? 'is-disabled' : ''}`}>
      <div className="frequency-curve__readout">
        {active != null ? (
          <>
            <span>{formatHz(EQ_FREQUENCIES[active])}</span>
            <strong>
              {activeBand != null && activeBand > 0 ? '+' : ''}
              {(activeBand ?? 0).toFixed(1)} dB
            </strong>
          </>
        ) : (
          <span className="frequency-curve__hint">Drag a node to shape your sound</span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="frequency-curve__svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={() => {
          if (!dragging.current) setActive(null)
        }}
        onDoubleClick={resetPoint}
        role="group"
        aria-label="Interactive 18-band equalizer curve"
      >
        <defs>
          <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-bright)" />
            <stop offset="50%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--cyan)" />
          </linearGradient>
          <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
            <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* gain grid */}
        {[12, 6, 0, -6, -12].map((gain) => {
          const y = center - (gain / RANGE) * (plotH / 2)
          return (
            <g key={gain}>
              <line
                x1={PAD_L}
                x2={VIEW_W - PAD_R}
                y1={y}
                y2={y}
                stroke={gain === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)'}
                strokeDasharray={gain === 0 ? '0' : '2 8'}
                strokeWidth="1"
              />
              <text
                x={PAD_L - 12}
                y={y + 3.5}
                textAnchor="end"
                className="frequency-curve__axis"
              >
                {gain > 0 ? `+${gain}` : gain}
              </text>
            </g>
          )
        })}

        {/* frequency grid */}
        {hzTicks.map((hz) => {
          const x = PAD_L + logRatio(hz) * plotW
          return (
            <g key={hz}>
              <line
                x1={x}
                x2={x}
                y1={PAD_T}
                y2={VIEW_H - PAD_B}
                stroke="rgba(255,255,255,0.045)"
                strokeWidth="1"
              />
              <text
                x={x}
                y={VIEW_H - 16}
                textAnchor="middle"
                className="frequency-curve__axis"
              >
                {hz >= 1000 ? `${hz / 1000}k` : hz}
              </text>
            </g>
          )
        })}

        <path d={areaPath(points, center)} fill={`url(#${uid}-area)`} />
        <path
          d={smoothPath(points)}
          fill="none"
          stroke={`url(#${uid}-line)`}
          strokeWidth="2.6"
          strokeLinecap="round"
          filter={`url(#${uid}-glow)`}
        />

        {points.map((point, index) => {
          const isActive = active === index
          return (
            <g key={index}>
              {isActive && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="13"
                  fill="var(--accent)"
                  opacity="0.15"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive ? 6 : 4}
                fill={isActive ? 'var(--accent-bright)' : 'var(--bg)'}
                stroke={isActive ? 'var(--accent-bright)' : 'var(--accent)'}
                strokeWidth="2"
              />
            </g>
          )
        })}
      </svg>
      <div className="frequency-curve__legend">
        <span>20 Hz</span>
        <span>1 kHz</span>
        <span>20 kHz</span>
      </div>
    </div>
  )
}
