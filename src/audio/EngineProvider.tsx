import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  const sync = useCallback(() => {
    setStatus(engine.state as EngineStatus)
  }, [engine])

  /**
   * Never dedupe across gestures: if a previous resume() attempt was rejected
   * or left pending by iOS, the next tap must be allowed to create/resume the
   * context again. armSync() runs synchronously inside the gesture.
   */
  const activate = useCallback(async () => {
    const ctx = engine.armSync()
    if (!ctx) {
      sync()
      return false
    }
    if (ctx.state !== 'running') {
      try {
        await ctx.resume()
      } catch {
        /* the next tap retries */
      }
    }
    sync()
    return ctx.state === 'running'
  }, [engine, sync])

  useEffect(() => engine.onStateChange(sync), [engine, sync])

  // Browsers require a gesture before audio can start. Listen to every event
  // iOS/Android may consider an activation so one of them always unlocks it.
  useEffect(() => {
    const unlock = () => {
      if (engine.state !== 'running') void activate()
    }
    const events: Array<keyof DocumentEventMap> = [
      'pointerdown',
      'touchstart',
      'touchend',
      'click',
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
