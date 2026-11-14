import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Tone = 'default' | 'success' | 'warn'

type Toast = {
  id: number
  message: string
  tone: Tone
}

type ToastContextValue = {
  toast: (message: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, tone: Tone = 'default') => {
    const id = ++counter.current
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <span className="toast__dot" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
