import {
  Outlet,
  Link,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { Home, Play } from 'lucide-react'
import { PlayProvider } from '@/lib/playContext'
import { MiniPlayer } from '@/components/MiniPlayer'
import { Toaster } from 'sonner'

export const Route = createRootRoute({
  component: RootComponent,
})

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const items = [
    { to: '/', label: 'Início', icon: Home },
    { to: '/play', label: 'Empire Play', icon: Play },
  ]
  return (
    <nav
      style={{
        position: 'fixed',
        inset: '0 0 auto 0',
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 40,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 4,
          alignItems: 'stretch',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)',
          padding: '4px 6px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(28px) saturate(180%)',
          pointerEvents: 'auto',
        }}
      >
        {items.map((it) => {
          const active =
            pathname === it.to ||
            (it.to !== '/' && pathname.startsWith(it.to))
          const Icon = it.icon
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-label={it.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                height: 48,
                width: 80,
                borderRadius: 999,
                textDecoration: 'none',
                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s',
              }}
            >
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

function RootComponent() {
  return (
    <PlayProvider>
      <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: 96 }}>
        <Outlet />
        <MiniPlayer />
        <BottomNav />
        <Toaster position="top-center" richColors closeButton />
      </div>
    </PlayProvider>
  )
}
