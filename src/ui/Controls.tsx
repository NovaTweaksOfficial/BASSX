import {
  useId,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'

type RangeProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
  hint?: string
  disabled?: boolean
  className?: string
  hideValue?: boolean
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  disabled,
  className = '',
  hideValue,
}: RangeProps) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={`range-control ${className}`}>
      <div className="range-control__head">
        <label htmlFor={id}>{label}</label>
        {!hideValue && (
          <output htmlFor={id} className="range-control__value">
            {format ? format(value) : value}
          </output>
        )}
      </div>
      {hint && <p className="range-control__hint">{hint}</p>}
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        aria-valuetext={format ? format(value) : String(value)}
      />
    </div>
  )
}

type ToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}

export function Toggle({ checked, onChange, label, hint }: ToggleProps) {
  return (
    <div className="toggle-row">
      <div className="toggle-row__text">
        <p className="toggle-row__label">{label}</p>
        {hint && <p className="toggle-row__hint">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__thumb" />
      </button>
    </div>
  )
}

type Option<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
}

type SegmentedProps<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  compact?: boolean
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  compact,
}: SegmentedProps<T>) {
  return (
    <div
      className={`segmented ${compact ? 'segmented--compact' : ''}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`segmented__option ${value === option.value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Panel({
  children,
  className = '',
  ...rest
}: {
  children: ReactNode
  className?: string
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`panel ${className}`} {...rest}>
      {children}
    </div>
  )
}
