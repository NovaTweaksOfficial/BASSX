import type { CSSProperties } from 'react'
import { EQ_FREQUENCIES, formatHzShort } from '../audio/types'

type Props = {
  bands: number[]
  onBandChange: (index: number, gain: number) => void
  bassFocus?: boolean
}

const BASS_FOCUS_BANDS = 9

export function EqSliders({ bands, onBandChange, bassFocus }: Props) {
  const indices = EQ_FREQUENCIES.map((_, index) => index).filter((index) =>
    bassFocus ? index < BASS_FOCUS_BANDS : true,
  )

  return (
    <div className="eq-bands-wrap">
      <div className={`eq-bands ${bassFocus ? 'eq-bands--focus' : ''}`}>
        {indices.map((index) => {
          const gain = bands[index] ?? 0
          const pct = ((gain + 12) / 24) * 100
          const display = Math.abs(gain) < 0.05 ? '0' : `${gain > 0 ? '+' : ''}${gain.toFixed(gain % 1 === 0 ? 0 : 1)}`
          return (
            <div className="band" key={EQ_FREQUENCIES[index]}>
              <output className={`band__value ${Math.abs(gain) >= 0.05 ? 'is-set' : ''}`}>
                {display}
              </output>
              <div className="band__track">
                <input
                  type="range"
                  className="slider slider--vertical"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={gain}
                  style={{ '--pct': `${pct}%` } as CSSProperties}
                  onChange={(event) => onBandChange(index, Number(event.target.value))}
                  onDoubleClick={() => onBandChange(index, 0)}
                  aria-label={`${formatHzShort(EQ_FREQUENCIES[index])} hertz band`}
                  aria-valuetext={`${gain} decibels`}
                />
                <span className="band__zero" aria-hidden="true" />
              </div>
              <span className="band__hz">{formatHzShort(EQ_FREQUENCIES[index])}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
