import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
  useRouterState,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Home, Play } from 'lucide-react'
import { PlayProvider } from './lib/playContext'
import { MiniPlayer } from './components/MiniPlayer'
import { Toaster } from 'sonner'
import EmpirePlayPage from './routes/play.index'
import IndexPage from './routes/index'
import './styles.css'

const queryClient = new QueryClient()

// ── Bottom Nav ──────────────────────────────────────────────────────────────
function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const items = [
    { to: '/' as const, label: 'Início', icon: Home },
    { to: '/play' as const, label: 'Empire Play', icon: Play },
  ]
  return (
    <nav style={{
      position: 'fixed',
      bottom: 'max(12px, env(safe-area-inset-bottom))',
      left: 0, right: 0,
      zIndex: 40,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex',
        gap: 4,
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

// ── Root ────────────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({
  component: () => (
    <PlayProvider>
      <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: 96 }}>
        <Outlet />
        <MiniPlayer />
        <BottomNav />
        <Toaster position="top-center" richColors closeButton />
      </div>
    </PlayProvider>
  ),
})

// ── Child routes ────────────────────────────────────────────────────────────
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
})

const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play',
  component: EmpirePlayPage,
})

// ── Router ──────────────────────────────────────────────────────────────────
const routeTree = rootRoute.addChildren([indexRoute, playRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

// ── Mount ───────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)
