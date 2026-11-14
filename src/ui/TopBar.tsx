import { useNavigate } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { useEngine } from '../audio/EngineProvider'
import { usePlayer } from '../player/PlayerProvider'
import { useToast } from './ToastProvider'
import { Logo } from './Logo'

export function TopBar() {
  const { status, supported, activate } = useEngine()
  const { isPlaying } = usePlayer()
  const { toast } = useToast()
  const navigate = useNavigate()

  const label = !supported
    ? 'Audio unsupported'
    : isPlaying
      ? 'Processing live'
      : status === 'running'
        ? 'Engine ready'
        : 'Tap to arm'
  const tone = !supported
    ? 'is-error'
    : status === 'running'
      ? 'is-live'
      : 'is-idle'

  const arm = async () => {
    if (!supported) {
      toast('This browser does not support the Web Audio API.', 'warn')
      return
    }
    if (status === 'running') {
      toast('The BASSX engine is live', 'success')
      return
    }
    const ok = await activate()
    toast(ok ? 'Audio engine armed — press play' : 'Tap once more to arm audio', ok ? 'success' : 'warn')
  }

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Logo />
        <div className="topbar__right">
          <button type="button" className={`engine-pill ${tone}`} onClick={() => void arm()}>
            <span className="engine-pill__dot" />
            <span>{label}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
