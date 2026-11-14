import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string
  title: ReactNode
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="page-header reveal">
      <div className="page-header__text">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </header>
  )
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
      {action}
    </div>
  )
}
