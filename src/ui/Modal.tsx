import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md'
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = 'sm',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const timer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input, textarea, button.primary, select',
      )
      first?.focus()
    }, 80)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal__head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
