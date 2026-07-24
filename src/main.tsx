import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlayProvider } from './lib/playContext'
import { MiniPlayer } from './components/MiniPlayer'
import { Toaster } from 'sonner'
import { BottomNav } from './components/BottomNav'
import { EmpirePlay } from './routes/play.index'
import IndexPage from './routes/index'
import './styles.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PlayProvider>
        <BrowserRouter>
          <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: 96 }}>
            <Routes>
              <Route path="/" element={<IndexPage />} />
              <Route path="/play" element={<EmpirePlay />} />
            </Routes>
            <MiniPlayer />
            <BottomNav />
          </div>
          <Toaster position="top-center" richColors closeButton />
        </BrowserRouter>
      </PlayProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
