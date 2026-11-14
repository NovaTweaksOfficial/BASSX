import { useCallback, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clamp } from '../audio/types'

type KnobProps = {
  value: number
  onChange: (value: number) => void
  label?: string
  sublabel?: string
  size?: number
  disabled?: boolean
}

/**
 * Large circular bass control. Drag vertically, scroll with +/- keys, or use
 * arrow keys. Values are committed continuously so the audio moves with the UI.
 */
export function Knob({
  value,
  onChange,
  label = 'Bass boost',
  sublabel,
  size = 244,
  disabled = false,
}: KnobProps) {
  const gradientId = useId().replace(/:/g, '')
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ startY: number; startValue: number } | null>(null)
  const safeValue = clamp(Math.round(value), 0, 100)

  const commit = useCallback(
    (next: number) => {
      onChange(clamp(Math.round(next), 0, 100))
    },
    [onChange],
  )

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startValue: safeValue }
    setDragging(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || disabled) return
    const delta = (drag.current.startY - event.clientY) / 2.3
    commit(drag.current.startValue + delta)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    drag.current = null
    setDragging(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const step = event.shiftKey ? 5 : 1
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      commit(safeValue + step)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      commit(safeValue - step)
    } else if (event.key === 'Home') {
      event.preventDefault()
      commit(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      commit(100)
    }
  }

  const ticks = Array.from({ length: 41 }, (_, i) => i)
  const activeTicks = Math.round((safeValue / 100) * 40)

  return (
    <div
      className={`knob ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
      style={{ width: size, height: size }}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      aria-valuetext={`${safeValue} percent`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <div className="knob__halo" aria-hidden="true" />
      <svg viewBox="0 0 240 240" className="knob__svg" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-deep)" />
            <stop offset="55%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-bright)" />
          </linearGradient>
          <radialGradient id={`${gradientId}-face`} cx="50%" cy="38%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.075)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.015)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </radialGradient>
        </defs>

        <g className="knob__ticks" aria-hidden="true">
          {ticks.map((tick) => {
            const angle = -135 + (tick / 40) * 270
            const active = tick <= activeTicks
            return (
              <line
                key={tick}
                x1="120"
                y1="17"
                x2="120"
                y2={tick % 5 === 0 ? 25 : 21}
                transform={`rotate(${angle} 120 120)`}
                stroke={active ? 'var(--accent)' : 'rgba(255,255,255,0.14)'}
                strokeWidth={tick % 5 === 0 ? 1.6 : 1}
                opacity={active ? 0.9 : 0.5}
              />
            )
          })}
        </g>

        <path
          d="M 49.3 190.7 A 100 100 0 1 1 190.7 190.7"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          className="knob__progress"
          d="M 49.3 190.7 A 100 100 0 1 1 190.7 190.7"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${Math.max(safeValue, 0.5)} 100`}
        />

        <circle cx="120" cy="120" r="82" fill={`url(#${gradientId}-face)`} stroke="rgba(255,255,255,0.08)" />
        <circle cx="120" cy="120" r="70" fill="none" stroke="rgba(255,255,255,0.035)" />
        <circle cx="120" cy="120" r="82" fill="none" stroke="var(--accent)" strokeOpacity="0.12" />
      </svg>

      <div className="knob__readout">
        <span className="knob__value">
          {safeValue}
          <span className="knob__unit">%</span>
        </span>
        <span className="knob__label">{label}</span>
        {sublabel && <span className="knob__sublabel">{sublabel}</span>}
      </div>
    </div>
  )
}
