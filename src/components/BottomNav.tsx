import { useLocation, Link } from 'react-router-dom'
import { Home, Play } from 'lucide-react'

const items = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/play', label: 'Empire Play', icon: Play },
] as const

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav style={{
      position: 'fixed',
      bottom: 'max(12px, env(safe-area-inset-bottom))',
      left: 0, right: 0, zIndex: 40,
      display: 'flex', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', gap: 4,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
        padding: '4px 6px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(28px) saturate(180%)',
        pointerEvents: 'auto',
      }}>
        {items.map((it) => {
          const active = pathname === it.to || (it.to !== '/' && pathname.startsWith(it.to))
          const Icon = it.icon
          return (
            <Link key={it.to} to={it.to} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 2, height: 48, width: 80,
              borderRadius: 999, textDecoration: 'none',
              background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.15s',
            }}>
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {it.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
