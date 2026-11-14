import { useEffect, useState } from 'react'
import { isStandalone } from '../lib/platform'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_FLAG = 'bassx.installPrompt'

export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => isStandalone())
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
      try {
        localStorage.setItem(INSTALL_FLAG, 'installed')
      } catch {
        /* noop */
      }
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!event) return 'unavailable'
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'dismissed') setDismissed(true)
    setEvent(null)
    return choice.outcome
  }

  return { canInstall: Boolean(event), installed, install, dismissed }
}
