import { Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'

export default function IndexPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Empire Hub
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Ambiente de testes
        </p>
      </div>
      <Link to="/play" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 24px', borderRadius: 999,
        background: '#fff', color: '#000',
        fontWeight: 700, fontSize: 14,
        textDecoration: 'none',
        transition: 'opacity 0.15s',
      }}>
        <Play size={16} fill="currentColor" />
        Abrir Empire Play
      </Link>
    </div>
  )
}
