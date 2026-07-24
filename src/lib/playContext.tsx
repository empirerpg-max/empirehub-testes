import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { telegramStreamUrl } from './telegramStorage'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaType = 'drive' | 'youtube' | 'telegram'

export type PlayItem = {
  id: string
  titulo: string
  artista: string
  capa: string
  /**
   * Drive file-id | YouTube video-id (11 chars) | URL completa
   * Para Telegram: prefixar com "tg:" + file_id
   * Ex: audioSrc = "tg:BQACAgIAAxk..."
   */
  audioSrc: string
  letra?: string
  categoria: 'musica' | 'musicvideo' | 'video'
}

type PlayerState = {
  queue: PlayItem[]
  currentIdx: number | null
  playing: boolean
}

type PlayContextType = {
  state: PlayerState
  play: (item: PlayItem, queue?: PlayItem[], opts?: { autoPlay?: boolean }) => void
  pause: () => void
  resume: () => void
  next: () => void
  prev: () => void
  close: () => void
  mediaType: MediaType | null
  currentMediaId: string | null
  audioRef: React.RefObject<HTMLAudioElement | null>
  ytPlayerRef: React.MutableRefObject<YT.Player | null>
  confirmPlaying: () => void
  confirmPaused: () => void
  onEnded: () => void
  /** @deprecated */
  iframeSrc: null
  /** @deprecated */
  syncPlaying: (v: boolean) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function extractDriveId(str: string): string | null {
  if (!str) return null
  const m =
    String(str).match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    String(str).match(/id=([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  if (!/^https?:\/\//.test(str) && !str.includes('/')) return str.trim()
  return null
}

export function extractYouTubeId(str: string): string | null {
  if (!str) return null
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const p of patterns) {
    const m = String(str).match(p)
    if (m) return m[1]
  }
  return null
}

/** Extrai o file_id de um audioSrc com prefixo "tg:" */
export function extractTelegramFileId(str: string): string | null {
  if (!str) return null
  if (str.startsWith('tg:')) return str.slice(3)
  return null
}

export function detectMediaType(audioSrc: string): MediaType {
  if (!audioSrc) return 'drive'
  const s = audioSrc.trim()
  if (s.startsWith('tg:')) return 'telegram'
  if (s.includes('youtube') || s.includes('youtu.be') || /^[a-zA-Z0-9_-]{11}$/.test(s)) {
    return 'youtube'
  }
  return 'drive'
}

export function driveStreamUrl(idOrUrl: string): string {
  const id = extractDriveId(idOrUrl) ?? idOrUrl
  return `https://empire-media-api.empirerpg-forum.workers.dev/?id=${id}`
}

/**
 * Resolve a URL de stream para qualquer tipo de mídia.
 * Use esta função no MiniPlayer em vez de chamar cada helper diretamente.
 */
export function resolveStreamUrl(audioSrc: string): string {
  const type = detectMediaType(audioSrc)
  if (type === 'telegram') return telegramStreamUrl(audioSrc)
  if (type === 'drive')    return driveStreamUrl(audioSrc)
  // YouTube não usa <audio> — é controlado via ytPlayerRef
  return audioSrc
}

/** @deprecated */
export const driveAudioPreview = driveStreamUrl
/** @deprecated */
export const driveProxyUrl = driveStreamUrl

// ─── Context ─────────────────────────────────────────────────────────────────

const PlayContext = createContext<PlayContextType | null>(null)

export function PlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    queue: [],
    currentIdx: null,
    playing: false,
  })

  const audioRef    = useRef<HTMLAudioElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ytPlayerRef = useRef<any>(null)

  const currentItem = state.currentIdx !== null ? state.queue[state.currentIdx] : null

  const mediaType: MediaType | null = currentItem ? detectMediaType(currentItem.audioSrc) : null

  const currentMediaId: string | null = currentItem
    ? mediaType === 'youtube'
      ? (extractYouTubeId(currentItem.audioSrc)    ?? currentItem.audioSrc)
      : mediaType === 'telegram'
        ? (extractTelegramFileId(currentItem.audioSrc) ?? currentItem.audioSrc)
        : (extractDriveId(currentItem.audioSrc)    ?? currentItem.audioSrc)
    : null

  const confirmPlaying = useCallback(() => setState((s) => ({ ...s, playing: true })), [])
  const confirmPaused  = useCallback(() => setState((s) => ({ ...s, playing: false })), [])
  const syncPlaying    = useCallback((v: boolean) => setState((s) => ({ ...s, playing: v })), [])

  const play = useCallback(
    (item: PlayItem, queue?: PlayItem[], opts?: { autoPlay?: boolean }) => {
      const newQueue = queue ?? [item]
      const idx = queue ? queue.findIndex((q) => q.id === item.id) : 0
      setState({ queue: newQueue, currentIdx: idx >= 0 ? idx : 0, playing: opts?.autoPlay === true })
    },
    []
  )

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause()
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.pauseVideo() } catch { /* */ }
    }
    setState((s) => ({ ...s, playing: false }))
  }, [])

  const resume = useCallback(() => setState((s) => ({ ...s, playing: true })), [])

  const close = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.stopVideo() } catch { /* */ }
    }
    setState({ queue: [], currentIdx: null, playing: false })
  }, [])

  const next = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s
      const nextIdx = s.currentIdx + 1
      if (nextIdx >= s.queue.length) return s
      return { ...s, currentIdx: nextIdx }
    })
  }, [])

  const prev = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s
      const prevIdx = s.currentIdx - 1
      if (prevIdx < 0) return s
      return { ...s, currentIdx: prevIdx }
    })
  }, [])

  const onEnded = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s
      const nextIdx = s.currentIdx + 1
      if (nextIdx < s.queue.length) return { ...s, currentIdx: nextIdx, playing: true }
      return { ...s, playing: false }
    })
  }, [])

  return (
    <PlayContext.Provider
      value={{
        state, play, pause, resume, next, prev, close,
        mediaType, currentMediaId,
        audioRef, ytPlayerRef,
        confirmPlaying, confirmPaused, onEnded,
        iframeSrc: null, syncPlaying,
      }}
    >
      {children}
    </PlayContext.Provider>
  )
}

export function usePlay() {
  const ctx = useContext(PlayContext)
  if (!ctx) throw new Error('usePlay must be used inside PlayProvider')
  return ctx
}
