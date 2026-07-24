import { useEffect, useRef, useCallback } from 'react'
import {
  usePlay,
  driveStreamUrl,
  detectMediaType,
  extractYouTubeId,
  extractDriveId,
} from '@/lib/playContext'
import { ChevronLeft, ChevronRight, X, Music } from 'lucide-react'

// YT API type shim
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

function driveImg(capa: string, size = 80): string {
  if (!capa) return ''
  const id = extractDriveId(capa) ?? (capa.match(/^[a-zA-Z0-9_-]{20,}$/) ? capa : null)
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`
  return capa
}

function useLoadYTApi(onReady: () => void) {
  const cbRef = useRef(onReady)
  cbRef.current = onReady
  useEffect(() => {
    if (window.YT?.Player) { cbRef.current(); return }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); cbRef.current() }
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  }, [])
}

export function MiniPlayer() {
  const {
    state, pause, resume, next, prev, close,
    mediaType, currentMediaId,
    audioRef, ytPlayerRef,
    confirmPlaying, confirmPaused, onEnded,
  } = usePlay()

  const { queue, currentIdx, playing } = state
  const ytContainerRef = useRef<HTMLDivElement>(null)
  const ytApiReady = useRef(false)
  const ytActiveId = useRef<string | null>(null)
  const pendingPlay = useRef(false)

  // 1. Cria <audio> nativo uma única vez
  useEffect(() => {
    if (audioRef.current) return
    const audio = new Audio()
    audio.preload = 'none'
    audio.crossOrigin = 'anonymous'
    audio.addEventListener('play', confirmPlaying)
    audio.addEventListener('pause', confirmPaused)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', () => {
      confirmPaused()
      console.error('[MiniPlayer] Erro ao carregar mídia')
    })
    audioRef.current = audio
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Cria / recria YT.Player
  const buildYTPlayer = useCallback(
    (videoId: string, autoStart: boolean) => {
      if (!ytContainerRef.current) return
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy() } catch { /* */ }
        ytPlayerRef.current = null
      }
      ytActiveId.current = videoId
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId,
        width: '1',
        height: '1',
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0, playsinline: 1 },
        events: {
          onReady(e: { target: { playVideo: () => void } }) {
            if (autoStart || pendingPlay.current) {
              pendingPlay.current = false
              e.target.playVideo()
            }
          },
          onStateChange(e: { data: number }) {
            const S = window.YT.PlayerState
            if (e.data === S.PLAYING) confirmPlaying()
            if (e.data === S.PAUSED) confirmPaused()
            if (e.data === S.ENDED) onEnded()
          },
          onError() { confirmPaused() },
        },
      })
    },
    [ytPlayerRef, confirmPlaying, confirmPaused, onEnded]
  )

  const onYTApiReady = useCallback(() => {
    ytApiReady.current = true
    if (mediaType === 'youtube' && currentMediaId && ytActiveId.current !== currentMediaId) {
      buildYTPlayer(currentMediaId, pendingPlay.current)
    }
  }, [mediaType, currentMediaId, buildYTPlayer])

  useLoadYTApi(onYTApiReady)

  // 3. Troca de faixa — configura src
  useEffect(() => {
    if (!currentMediaId) return
    if (mediaType === 'drive') {
      const audio = audioRef.current
      if (!audio) return
      audio.pause()
      audio.src = driveStreamUrl(currentMediaId)
      audio.load()
    }
    if (mediaType === 'youtube') {
      if (!ytApiReady.current) return
      if (ytActiveId.current !== currentMediaId) buildYTPlayer(currentMediaId, false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, mediaType])

  // 4. Auto-play quando playing=true
  useEffect(() => {
    if (!currentMediaId || !playing) return
    const id = setTimeout(() => {
      if (mediaType === 'drive') {
        audioRef.current?.play().catch(() => confirmPaused())
      }
      if (mediaType === 'youtube') {
        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.playVideo() } catch { pendingPlay.current = true }
        } else {
          pendingPlay.current = true
          if (ytApiReady.current && currentMediaId) buildYTPlayer(currentMediaId, true)
        }
      }
    }, 50)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, playing])

  // 5. Cleanup
  useEffect(() => {
    return () => { audioRef.current?.pause() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const triggerPlay = useCallback(() => {
    if (mediaType === 'drive') {
      audioRef.current?.play().catch(() => confirmPaused())
      return
    }
    if (mediaType === 'youtube') {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.playVideo() } catch { pendingPlay.current = true }
      } else {
        pendingPlay.current = true
        if (ytApiReady.current && currentMediaId) buildYTPlayer(currentMediaId, true)
      }
    }
  }, [mediaType, audioRef, ytPlayerRef, currentMediaId, buildYTPlayer, confirmPaused])

  if (currentIdx === null || queue.length === 0) return null

  const item = queue[currentIdx]
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < queue.length - 1

  const handlePlayPause = () => {
    if (playing) {
      pendingPlay.current = false
      pause()
    } else {
      resume()
      triggerPlay()
    }
  }

  return (
    <div className="fixed bottom-16 inset-x-0 z-40 bg-card border-t border-white/10 shadow-2xl">
      {mediaType === 'youtube' && (
        <div
          style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', zIndex: -1, overflow: 'hidden' }}
          aria-hidden="true"
        >
          <div ref={ytContainerRef} />
        </div>
      )}
      <div className="mx-auto max-w-2xl px-4 py-2 flex items-center gap-3">
        <div className="size-10 rounded-lg overflow-hidden bg-primary/10 flex-shrink-0">
          {item.capa ? (
            <img src={driveImg(item.capa, 80)} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="w-full h-full grid place-items-center"><Music className="size-4 text-primary" /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black truncate uppercase tracking-tight">{item.titulo}</p>
          <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => prev()} disabled={!hasPrev} className="size-8 grid place-items-center text-muted-foreground disabled:opacity-20 transition-opacity" aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={handlePlayPause} className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center transition-transform active:scale-95" aria-label={playing ? 'Pausar' : 'Reproduzir'}>
            {playing ? (
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            ) : (
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><polygon points="5,3 19,12 5,21" /></svg>
            )}
          </button>
          <button onClick={() => next()} disabled={!hasNext} className="size-8 grid place-items-center text-muted-foreground disabled:opacity-20 transition-opacity" aria-label="Próxima">
            <ChevronRight className="size-4" />
          </button>
          <button onClick={close} className="size-8 grid place-items-center text-muted-foreground ml-1" aria-label="Fechar player">
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
