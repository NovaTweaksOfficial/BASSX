import { NavLink } from 'react-router-dom'
import { Disc3, House, Settings2, SlidersHorizontal, Sparkles } from 'lucide-react'

const items = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/equalizer', label: 'Equalizer', icon: SlidersHorizontal },
  { to: '/player', label: 'Player', icon: Disc3 },
  { to: '/presets', label: 'Presets', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings2 },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__glow" aria-hidden="true" />
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
        >
          <span className="nav-item__icon">
            <item.icon size={20} strokeWidth={1.8} />
          </span>
          <span className="nav-item__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
