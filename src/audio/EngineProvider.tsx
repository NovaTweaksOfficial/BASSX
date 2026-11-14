import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getEngine, type BassEngine } from '../audio/engine'

export type EngineStatus = 'idle' | 'running' | 'suspended' | 'unsupported' | 'closed'

type EngineContextValue = {
  engine: BassEngine
  status: EngineStatus
  activate: () => Promise<boolean>
  supported: boolean
}

const EngineContext = createContext<EngineContextValue | null>(null)

export function EngineProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => getEngine(), [])
  const [status, setStatus] = useState<EngineStatus>(() => engine.state as EngineStatus)
  const activating = useRef<Promise<boolean> | null>(null)

  const sync = useCallback(() => {
    setStatus(engine.state as EngineStatus)
  }, [engine])

  const activate = useCallback(async () => {
    if (activating.current) return activating.current
    activating.current = (async () => {
      const ctx = await engine.ensure()
      sync()
      return Boolean(ctx && ctx.state === 'running')
    })()
    try {
      return await activating.current
    } finally {
      activating.current = null
    }
  }, [engine, sync])

  useEffect(() => {
    const interval = window.setInterval(sync, 1200)
    return () => window.clearInterval(interval)
  }, [sync])

  // Browsers require a gesture before audio can start. Every gesture is a
  // chance to recover from a suspended context, so we do not use { once }.
  useEffect(() => {
    const unlock = () => {
      if (engine.state === 'suspended' || engine.state === 'idle') {
        void activate()
      }
    }
    const events: Array<keyof DocumentEventMap> = [
      'pointerdown',
      'touchstart',
      'keydown',
    ]
    events.forEach((event) => document.addEventListener(event, unlock, { passive: true }))
    return () =>
      events.forEach((event) => document.removeEventListener(event, unlock))
  }, [activate, engine])

  const value = useMemo(
    () => ({ engine, status, activate, supported: engine.supported }),
    [engine, status, activate],
  )

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>
}

export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext)
  if (!ctx) throw new Error('useEngine must be used inside EngineProvider')
  return ctx
}
