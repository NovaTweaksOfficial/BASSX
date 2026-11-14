import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { usePlayer } from '../player/PlayerProvider'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { MiniPlayer } from './MiniPlayer'

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { togglePlay, seek, time } = usePlayer()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  // Global transport shortcuts — ignored while typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        void togglePlay()
      } else if (event.code === 'ArrowRight') {
        event.preventDefault()
        seek(time + 5)
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault()
        seek(time - 5)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, seek, time])

  return (
    <div className="app">
      <div className="app-bg" aria-hidden="true">
        <span className="orb orb--one" />
        <span className="orb orb--two" />
        <span className="orb orb--three" />
      </div>
      <div className="app-noise" aria-hidden="true" />

      <TopBar />
      <main id="main" className="app-main">
        {children}
      </main>
      <MiniPlayer />
      <BottomNav />
    </div>
  )
}
