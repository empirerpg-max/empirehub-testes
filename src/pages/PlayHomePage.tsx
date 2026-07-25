import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Radio, Play, Music, Tv, MessageSquare,
  ChevronRight, Home, Clapperboard, ChevronLeft,
  AlertCircle, Upload, Youtube,
  HardDrive, Loader2, CheckCircle2, FlaskConical,
  RefreshCw, ArrowLeft,
} from 'lucide-react'
import { usePlay, type PlayItem } from '@/lib/playContext'
import {
  uploadToTelegram,
  getTelegramCatalog,
  telegramStreamUrl,
  deleteTelegramEntry,
  type TelegramMediaMeta,
} from '@/lib/telegramStorage'
import {
  fetchMusicas,
  fetchMusicVideos,
  fetchVideos,
  fetchCharts,
  type SheetRow,
  type ChartData,
} from '@/lib/sheetsService'
import { ForumChat } from '@/components/ForumChat'
import { UploadForm } from '@/components/UploadForm'

// ─── Mocks (fallback quando GAS_URL não está configurado) ─────────────────────
let musicasMock: SheetRow[] = []
let clipesMock:  SheetRow[] = []
let videosMock:  SheetRow[] = []
let chartsMockData: ChartData[] = []

;(async () => {
  try { musicasMock    = ((await import('@/mocks/musicas.json')) as { default: SheetRow[] }).default }    catch { /* sem mock */ }
  try { clipesMock     = ((await import('@/mocks/clipes.json'))  as { default: SheetRow[] }).default }    catch { /* sem mock */ }
  try { videosMock     = ((await import('@/mocks/videos.json'))  as { default: SheetRow[] }).default }    catch { /* sem mock */ }
  try { chartsMockData = ((await import('@/mocks/charts.json'))  as { default: ChartData[] }).default }   catch { /* sem mock */ }
})()

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'musicas' | 'clipes' | 'videos' | 'forum'
type ForumSubTab = 'topicos' | 'lancar' | 'chat'
type FonteAudio  = 'youtube' | 'drive' | 'upload'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'home',    label: 'Início',  icon: Home },
  { id: 'musicas', label: 'Músicas', icon: Music },
  { id: 'clipes',  label: 'Clipes',  icon: Clapperboard },
  { id: 'videos',  label: 'Vídeos',  icon: Tv },
  { id: 'forum',   label: 'Fórum',   icon: MessageSquare },
]

export type ChartEntry = {
  posicao: number
  titulo: string
  capa: string
  playItem?: PlayItem
}

export type { ChartData }

type ForumTopico = {
  id: string
  item: PlayItem
  fonte: FonteAudio
  /** aba da planilha para buscar comentários */
  categoria: 'musicas' | 'musicVideos' | 'videos'
}

const IS_DEV_MODE = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('dev') === '1'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function norm(s: string) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function getField(item: Record<string, string>, ...aliases: string[]): string {
  if (!item) return ''
  const keys = Object.keys(item)
  const normKeys = keys.map((k) => ({ orig: k, norm: norm(k) }))
  for (const alias of aliases) {
    const target = norm(alias)
    const found = normKeys.find((k) => k.norm === target)
    if (found && item[found.orig] != null && item[found.orig] !== '') return item[found.orig]
  }
  return ''
}

function extractDriveId(str: string): string | null {
  if (!str) return null
  const m = String(str).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(str).match(/id=([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  if (!/^https?:\/\//.test(str) && !str.includes('/') && str.length > 10) return str.trim()
  return null
}

function extractYoutubeId(str: string): string | null {
  if (!str) return null
  const s = str.trim()
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/)
  if (m) return m[1]
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  return null
}

function driveThumb(capa: string, size = 300): string {
  if (!capa) return ''
  const id = extractDriveId(capa) || (capa.match(/^[a-zA-Z0-9_-]{20,}$/) ? capa : null)
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`
  return capa
}

function parseDataLancamento(item: SheetRow): number {
  const raw = getField(item, 'Data de lançamento', 'Data de lancamento', 'data_de_lancamento', 'datadelancamento', 'data', 'release_date', 'uploaded_at', 'uploadedAt')
  if (!raw || raw.trim() === '') return 0
  const s = raw.trim()
  const brDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (brDate) {
    const iso = `${brDate[3]}-${brDate[2].padStart(2, '0')}-${brDate[1].padStart(2, '0')}`
    const t = new Date(iso).getTime()
    return isNaN(t) ? 0 : t
  }
  if (/^\d+$/.test(s)) { const n = parseInt(s, 10); return n < 1e12 ? n * 1000 : n }
  const t = new Date(s).getTime()
  return isNaN(t) ? 0 : t
}

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

function resolveAudioSrc(row: SheetRow): string {
  const tgId = getField(row, 'telegram_file_id', 'telegramfileid', 'telegram_id')
  if (tgId) return `tg:${tgId}`
  const ytRaw = getField(row, 'youtube_id', 'youtubeid', 'youtubeId', 'id_youtube', 'link_youtube')
  if (ytRaw) {
    const ytId = extractYoutubeId(ytRaw)
    if (ytId) return ytId
  }
  const drRaw = getField(row, 'drive_file_id', 'drivefileid', 'driveFileId', 'id_drive', 'link_drive', 'id_do_arquivo', 'idarquivo')
  if (drRaw) {
    const drId = extractDriveId(drRaw)
    if (drId) return drId
  }
  return getField(row, 'audioUrl', 'audio_url', 'link', 'url', 'arquivo')
}

function rowToPlayItem(row: SheetRow, cat: PlayItem['categoria']): PlayItem {
  const titulo = getField(row,
    'titulo', 'title', 'nome', 'nome_da_musica', 'nomedamusica',
    'nome_do_video', 'nomedovideo', 'tipo_de_clipe', 'tipodeclipe'
  )
  const artista = getField(row, 'artista', 'artist', 'act_principal', 'actprincipal', 'uploaded_by', 'uploadedBy')
  const capa = getField(row, 'capa', 'capa_url', 'capaUrl', 'capa_da_musica', 'capadamusica', 'cover')
  const audioSrc = resolveAudioSrc(row)
  const id = getField(row, 'id', 'id_do_topico', 'idtopico', 'topico_id') || audioSrc || `${cat}-${titulo}`
  const letra = getField(row, 'letra', 'lyrics')
  return { id, titulo, artista, capa, audioSrc, letra, categoria: cat }
}

/** Infere a categoria do fórum a partir da categoria do PlayItem */
function inferCategoria(cat: PlayItem['categoria']): ForumTopico['categoria'] {
  if (cat === 'musicvideo') return 'musicVideos'
  if (cat === 'video')      return 'videos'
  return 'musicas'
}

// ─── Skeletons ────────────────────────────────────────────────────────────────
function SkeletonGrid({ cols = 3, rows = 2 }: { cols?: number; rows?: number }) {
  return (
    <div className={`grid grid-cols-${cols} gap-3`}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-square rounded-2xl bg-white/[0.05] animate-pulse" />
          <div className="h-3 w-3/4 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="h-2.5 w-1/2 rounded-full bg-white/[0.03] animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="size-12 rounded-xl bg-white/[0.05] animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded-full bg-white/[0.04] animate-pulse" />
            <div className="h-2.5 w-1/3 rounded-full bg-white/[0.03] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────────
function SongCard({ item, queue }: { item: PlayItem; queue: PlayItem[] }) {
  const { play, state } = usePlay()
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id
  return (
    <button onClick={() => play(item, queue, { autoPlay: true })} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-primary/10 ${isActive ? 'ring-2 ring-primary' : ''} transition-all`}>
        {item.capa ? (
          <img src={driveThumb(item.capa, 300)} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Music className="size-8 text-primary/40" /></div>
        )}
        <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 grid place-items-center">
          <div className="size-10 rounded-full bg-primary/0 group-active:bg-primary/90 grid place-items-center transition-all">
            <Play className="size-5 text-white opacity-0 group-active:opacity-100" fill="white" />
          </div>
        </div>
        {isActive && (
          <div className="absolute bottom-2 left-2 flex gap-0.5 items-end">
            {[3, 5, 4].map((h, i) => (
              <div key={i} className="w-1 bg-primary rounded-full animate-bounce" style={{ height: `${h * 3}px`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? 'text-primary' : ''}`}>{item.titulo || '—'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
      </div>
    </button>
  )
}

function SongCardWithDate({ item, queue, rawDate }: { item: PlayItem; queue: PlayItem[]; rawDate: string }) {
  const { play, state } = usePlay()
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id

  const { dataFormatada, isNovo } = useMemo(() => {
    if (!rawDate || rawDate.trim() === '') return { dataFormatada: '', isNovo: false }
    const s = rawDate.trim()
    let ts = 0
    const brDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (brDate) ts = new Date(`${brDate[3]}-${brDate[2].padStart(2,'0')}-${brDate[1].padStart(2,'0')}`).getTime()
    else if (/^\d+$/.test(s)) { const n = parseInt(s,10); ts = n < 1e12 ? n*1000 : n }
    else ts = new Date(s).getTime()
    if (!ts || isNaN(ts)) return { dataFormatada: '', isNovo: false }
    return { dataFormatada: formatDate(ts), isNovo: (Date.now() - ts) / (1000*60*60*24) <= 30 }
  }, [rawDate])

  return (
    <button onClick={() => play(item, queue, { autoPlay: true })} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-primary/10 ${isActive ? 'ring-2 ring-primary' : ''} transition-all`}>
        {item.capa ? (
          <img src={driveThumb(item.capa, 300)} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Music className="size-8 text-primary/40" /></div>
        )}
        {isNovo && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest">Novo</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 grid place-items-center">
          <div className="size-10 rounded-full bg-primary/0 group-active:bg-primary/90 grid place-items-center transition-all">
            <Play className="size-5 text-white opacity-0 group-active:opacity-100" fill="white" />
          </div>
        </div>
        {isActive && (
          <div className="absolute bottom-2 left-2 flex gap-0.5 items-end">
            {[3,5,4].map((h,i) => <div key={i} className="w-1 bg-primary rounded-full animate-bounce" style={{height:`${h*3}px`,animationDelay:`${i*100}ms`}} />)}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? 'text-primary' : ''}`}>{item.titulo || '—'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
        {dataFormatada && <p className="text-[9px] text-muted-foreground/50 truncate mt-0.5">Lançada em {dataFormatada}</p>}
      </div>
    </button>
  )
}

function VideoCard({ item, queue }: { item: PlayItem; queue: PlayItem[] }) {
  const { play, state } = usePlay()
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id
  return (
    <button onClick={() => play(item, queue, { autoPlay: true })} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative w-full rounded-2xl overflow-hidden bg-primary/10 aspect-video ${isActive ? 'ring-2 ring-primary' : ''} transition-all`}>
        {item.capa ? (
          <img src={driveThumb(item.capa, 400)} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Tv className="size-8 text-primary/40" /></div>
        )}
        <div className="absolute inset-0 grid place-items-center">
          <div className="size-10 rounded-full bg-black/40 group-active:bg-primary/90 grid place-items-center transition-all">
            <Play className="size-5 text-white" fill="white" />
          </div>
        </div>
        {isActive && (
          <div className="absolute bottom-2 left-2 flex gap-0.5 items-end">
            {[3,5,4].map((h,i) => <div key={i} className="w-1 bg-primary rounded-full animate-bounce" style={{height:`${h*3}px`,animationDelay:`${i*100}ms`}} />)}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? 'text-primary' : ''}`}>{item.titulo || '—'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
      </div>
    </button>
  )
}

function RowTrack({ item, queue, num, rawDate }: { item: PlayItem; queue: PlayItem[]; num: number; rawDate?: string }) {
  const { play, state } = usePlay()
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id
  const dataFormatada = useMemo(() => {
    if (!rawDate || rawDate.trim() === '') return ''
    const s = rawDate.trim()
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s
    if (/^\d+$/.test(s)) { const n = parseInt(s,10); return formatDate(n < 1e12 ? n*1000 : n) }
    const t = new Date(s).getTime()
    return isNaN(t) ? s : formatDate(t)
  }, [rawDate])

  return (
    <button
      onClick={() => play(item, queue, { autoPlay: true })}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${
        isActive ? 'bg-primary/10 border border-primary/30' : 'hover:bg-white/[0.04] border border-transparent'
      }`}
    >
      <div className="size-5 flex-shrink-0 grid place-items-center">
        {isActive ? (
          <div className="flex gap-0.5 items-end">
            {[3,5,4].map((h,i) => <div key={i} className="w-0.5 bg-primary rounded-full animate-bounce" style={{height:`${h*2}px`,animationDelay:`${i*100}ms`}} />)}
          </div>
        ) : (
          <span className="text-[10px] font-black text-muted-foreground/50">{num}</span>
        )}
      </div>
      <div className="size-10 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
        {item.capa ? (
          <img src={driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Music className="size-4 text-primary/30" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? 'text-primary' : ''}`}>{item.titulo || '—'}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {item.artista}
          {dataFormatada && <span className="ml-1.5 opacity-50">· {dataFormatada}</span>}
        </p>
      </div>
      <Play className="size-4 text-muted-foreground/40 flex-shrink-0" fill="currentColor" />
    </button>
  )
}

function ChartRow({ entry, queue }: { entry: ChartEntry; queue: PlayItem[] }) {
  const { play, state } = usePlay()
  const isActive = entry.playItem && state.currentIdx !== null && state.queue[state.currentIdx]?.id === entry.playItem.id
  const canPlay = !!entry.playItem?.audioSrc
  return (
    <button
      onClick={() => { if (entry.playItem) play(entry.playItem, queue, { autoPlay: true }) }}
      disabled={!canPlay}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${
        isActive ? 'bg-primary/10 border border-primary/30'
        : canPlay ? 'border border-transparent active:bg-white/[0.04]'
        : 'border border-transparent opacity-60 cursor-default'
      }`}
    >
      <div className="w-5 flex-shrink-0 text-center">
        {isActive ? (
          <div className="flex gap-0.5 items-end justify-center">
            {[3,5,4].map((h,i) => <div key={i} className="w-0.5 bg-primary rounded-full animate-bounce" style={{height:`${h*2}px`,animationDelay:`${i*100}ms`}} />)}
          </div>
        ) : (
          <span className={`text-[10px] font-black ${entry.posicao <= 3 ? 'text-primary' : 'text-muted-foreground/50'}`}>{entry.posicao}</span>
        )}
      </div>
      <div className="size-10 rounded-xl overflow-hidden bg-white/[0.05] flex-shrink-0">
        {entry.capa ? (
          <img src={driveThumb(entry.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Music className="size-4 text-white/10" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? 'text-primary' : canPlay ? '' : 'text-muted-foreground'}`}>{entry.titulo}</p>
      </div>
    </button>
  )
}

function SectionHeader({ icon, title, onMore }: { icon: React.ReactNode; title: string; onMore?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">{icon}{title}</h2>
      {onMore && (
        <button onClick={onMore} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1 active:text-primary transition-colors">
          Ver tudo <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  )
}

function ChartMiniCard({ chart, onOpen }: { chart: ChartData; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="w-full text-left bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem] overflow-hidden active:border-primary/30 transition-all">
      <div className="relative w-full aspect-square bg-white/[0.05] grid place-items-center">
        {chart.capaDaPlaylist ? (
          <img src={driveThumb(chart.capaDaPlaylist, 300)} alt={chart.nome} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span className="text-5xl">{chart.icone}</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[11px] font-black text-white leading-tight">{chart.subtitulo}</p>
        </div>
      </div>
    </button>
  )
}

function ChartDetailView({ chart, onBack }: { chart: ChartData; onBack: () => void }) {
  const queue = chart.entries
    .filter((e): e is ChartEntry & { playItem: PlayItem } => !!e.playItem?.audioSrc)
    .map(e => e.playItem)
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors">
        <ChevronLeft className="size-4" /> Charts
      </button>
      <div className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem]">
        <div className="size-16 rounded-2xl overflow-hidden bg-white/[0.05] flex-shrink-0 grid place-items-center">
          <span className="text-3xl">{chart.icone}</span>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{chart.icone} {chart.nome}</p>
          <p className="text-base font-black tracking-tight">{chart.subtitulo}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{chart.entries.length} faixas</p>
        </div>
      </div>
      <div className="space-y-0.5">
        {chart.entries.map((entry) => <ChartRow key={entry.posicao} entry={entry} queue={queue} />)}
      </div>
    </div>
  )
}

// ─── ForumTopicosList ─────────────────────────────────────────────────────────
function ForumTopicosList({
  topicos,
  onSelect,
}: {
  topicos: ForumTopico[]
  onSelect: (t: ForumTopico) => void
}) {
  const { play } = usePlay()
  const queue = topicos.map(t => t.item)

  if (topicos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <MessageSquare className="size-10 text-muted-foreground/20" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">Nenhum lançamento ainda</p>
        <p className="text-[10px] text-muted-foreground/30">Use o formulário de lançamento para publicar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {topicos.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            play(t.item, queue, { autoPlay: true })
            onSelect(t)
          }}
          className="w-full flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-2xl active:border-primary/30 transition-all text-left"
        >
          <div className="size-12 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
            {t.item.capa
              ? <img src={driveThumb(t.item.capa, 80)} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full grid place-items-center"><Music className="size-5 text-primary/30" /></div>
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black truncate uppercase tracking-tight">{t.item.titulo}</p>
            <p className="text-[10px] text-muted-foreground truncate">{t.item.artista || '—'}</p>
            <p className="text-[9px] text-muted-foreground/40 mt-0.5 uppercase tracking-widest flex items-center gap-1">
              <MessageSquare className="size-2.5" /> Abrir chat
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground/30 flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ─── TelegramDevTab ───────────────────────────────────────────────────────────
function TelegramDevTab() {
  const { play } = usePlay()
  const [catalog, setCatalog] = useState<TelegramMediaMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadCatalog() {
    setLoading(true); setErro('')
    try { setCatalog(await getTelegramCatalog()) }
    catch (e: unknown) { setErro(e instanceof Error ? e.message : 'Erro ao carregar catálogo') }
    finally { setLoading(false) }
  }

  async function handleUpload() {
    if (!arquivo) return
    setUploading(true); setErro('')
    try {
      await uploadToTelegram(arquivo, { titulo: arquivo.name })
      setArquivo(null)
      await loadCatalog()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Upload falhou')
    } finally { setUploading(false) }
  }

  async function handleDelete(fileId: string) {
    await deleteTelegramEntry(fileId)
    setCatalog((prev) => prev.filter((m) => m.file_id !== fileId))
  }

  useEffect(() => { loadCatalog() }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
        <FlaskConical className="size-4 text-yellow-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Dev — Telegram Storage</p>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teste de upload</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex-1 h-11 flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground active:border-primary/50 transition-colors">
            <Upload className="size-4" />
            {arquivo ? arquivo.name.slice(0, 20) + '…' : 'Selecionar arquivo'}
          </button>
          <button onClick={handleUpload} disabled={!arquivo || uploading}
            className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Enviar
          </button>
          <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Catálogo ({catalog.length})</p>
          <button onClick={loadCatalog} className="text-[10px] font-black uppercase tracking-widest text-primary active:opacity-60">Atualizar</button>
        </div>
        {loading && <SkeletonList rows={3} />}
        {erro && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <AlertCircle className="size-4 text-red-400" />
            <p className="text-xs text-red-400">{erro}</p>
          </div>
        )}
        {!loading && catalog.length === 0 && !erro && (
          <p className="text-center text-xs text-muted-foreground py-8 opacity-40">Nenhum arquivo no catálogo.</p>
        )}
        {catalog.map((m) => (
          <div key={m.file_id} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-2xl">
            <div className="size-10 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0 grid place-items-center">
              {m.capa ? <img src={driveThumb(m.capa, 80)} alt="" className="w-full h-full object-cover" /> : <Music className="size-4 text-primary/40" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black truncate uppercase tracking-tight">{m.titulo || m.file_id.slice(0,16)}</p>
              <p className="text-[10px] text-muted-foreground truncate">{m.artista || '—'} · {(m.file_size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button onClick={() => play(
              { id: m.file_id, titulo: m.titulo || '', artista: m.artista || '', capa: m.capa || '', audioSrc: telegramStreamUrl(m.file_id), categoria: 'musica' },
              [], { autoPlay: true }
            )} className="size-8 rounded-full bg-primary/20 grid place-items-center active:bg-primary/60 transition-colors">
              <Play className="size-4 text-primary" fill="currentColor" />
            </button>
            <button onClick={() => handleDelete(m.file_id)}
              className="size-8 rounded-full bg-red-500/10 grid place-items-center active:bg-red-500/30 transition-colors">
              <span className="text-red-400 text-xs font-black">✕</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tabs de conteúdo ─────────────────────────────────────────────────────────
function MusicasTab({ rows, loading }: { rows: SheetRow[]; loading: boolean }) {
  const items = useMemo(() => rows.map(r => rowToPlayItem(r, 'musica')), [rows])
  const queue = items

  if (loading) return <SkeletonGrid cols={3} rows={3} />
  if (items.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Music className="size-10 text-muted-foreground/20" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">Sem músicas</p>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, i) => {
          const rawDate = getField(rows[i], 'Data de lançamento', 'data_de_lancamento', 'data', 'uploaded_at')
          return <SongCardWithDate key={item.id} item={item} queue={queue} rawDate={rawDate} />
        })}
      </div>
    </div>
  )
}

function ClipesTab({ rows, loading }: { rows: SheetRow[]; loading: boolean }) {
  const items = useMemo(() => rows.map(r => rowToPlayItem(r, 'musicvideo')), [rows])
  const queue = items

  if (loading) return <SkeletonGrid cols={2} rows={3} />
  if (items.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Clapperboard className="size-10 text-muted-foreground/20" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">Sem clipes</p>
    </div>
  )
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(item => <VideoCard key={item.id} item={item} queue={queue} />)}
    </div>
  )
}

function VideosTab({ rows, loading }: { rows: SheetRow[]; loading: boolean }) {
  const items = useMemo(() => rows.map(r => rowToPlayItem(r, 'video')), [rows])
  const queue = items

  if (loading) return <SkeletonGrid cols={2} rows={3} />
  if (items.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Tv className="size-10 text-muted-foreground/20" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">Sem vídeos</p>
    </div>
  )
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(item => <VideoCard key={item.id} item={item} queue={queue} />)}
    </div>
  )
}

// ─── HomeTab ──────────────────────────────────────────────────────────────────
function HomeTab({
  musicasRows, musicVideosRows, charts, loading, onTabChange,
}: {
  musicasRows: SheetRow[]
  musicVideosRows: SheetRow[]
  charts: ChartData[]
  loading: boolean
  onTabChange: (t: Tab) => void
}) {
  const [openChart, setOpenChart] = useState<ChartData | null>(null)
  const [homeSection, setHomeSection] = useState<'charts' | 'lancamentos'>('charts')

  const lancMusicas = useMemo<{ item: PlayItem; rawDate: string }[]>(
    () => [...musicasRows]
      .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
      .slice(0, 5)
      .map(r => ({
        item: rowToPlayItem(r, 'musica'),
        rawDate: getField(r, 'Data de lançamento', 'data_de_lancamento', 'data', 'uploaded_at'),
      })),
    [musicasRows]
  )

  const lancVideos = useMemo<PlayItem[]>(
    () => [...musicVideosRows]
      .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
      .slice(0, 5)
      .map(r => rowToPlayItem(r, 'musicvideo')),
    [musicVideosRows]
  )

  if (openChart) return <ChartDetailView chart={openChart} onBack={() => setOpenChart(null)} />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(['charts', 'lancamentos'] as const).map((s) => (
          <button key={s} onClick={() => setHomeSection(s)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${homeSection === s ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground'}`}>
            {s === 'charts' ? '🏆 Top Charts' : '✨ Lançamentos'}
          </button>
        ))}
      </div>

      {homeSection === 'charts' && (
        <section className="space-y-4">
          <SectionHeader icon={<span>🏆</span>} title="Top Charts" />
          {charts.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4 opacity-40">Nenhum chart disponível.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {charts.map((c) => <ChartMiniCard key={c.nome} chart={c} onOpen={() => setOpenChart(c)} />)}
            </div>
          )}
        </section>
      )}

      {homeSection === 'lancamentos' && (
        <section className="space-y-6">
          {loading ? (
            <><SkeletonList rows={5} /><SkeletonList rows={5} /></>
          ) : (
            <>
              {lancMusicas.length > 0 && (
                <div>
                  <SectionHeader icon={<Music className="size-4 text-primary" />} title="Últimas Músicas" onMore={() => onTabChange('musicas')} />
                  <div className="space-y-1">
                    {lancMusicas.map(({ item, rawDate }, i) => (
                      <RowTrack key={item.id} item={item} queue={lancMusicas.map(x => x.item)} num={i + 1} rawDate={rawDate} />
                    ))}
                  </div>
                </div>
              )}
              {lancVideos.length > 0 && (
                <div>
                  <SectionHeader icon={<Clapperboard className="size-4 text-primary" />} title="Últimos Clipes" onMore={() => onTabChange('clipes')} />
                  <div className="grid grid-cols-2 gap-3">
                    {lancVideos.map(item => <VideoCard key={item.id} item={item} queue={lancVideos} />)}
                  </div>
                </div>
              )}
              {lancMusicas.length === 0 && lancVideos.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Radio className="size-10 text-muted-foreground/20" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">Sem lançamentos ainda</p>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

// ─── ForumSection ─────────────────────────────────────────────────────────────
function ForumSection({
  topicos,
  onNovoTopico,
}: {
  topicos: ForumTopico[]
  onNovoTopico: (t: ForumTopico) => void
}) {
  const [subTab, setSubTab]           = useState<ForumSubTab>('topicos')
  const [selectedTopico, setSelected] = useState<ForumTopico | null>(null)

  function handleNovoTopico(t: ForumTopico) {
    onNovoTopico(t)
    setSelected(t)
    setSubTab('chat')
  }

  function handleSelect(t: ForumTopico) {
    setSelected(t)
    setSubTab('chat')
  }

  if (subTab === 'chat' && selectedTopico) {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => { setSubTab('topicos'); setSelected(null) }}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar aos tópicos
        </button>
        <ForumChat
          topicId={selectedTopico.id}
          categoria={selectedTopico.categoria}
          item={selectedTopico.item}
          nomeJogador="Visitante"
          idJogador="anon"
        />
      </div>
    )
  }

  if (subTab === 'lancar') {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setSubTab('topicos')}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </button>
        <UploadForm
          onSuccess={(threadId: string, fileUrl: string, titulo: string, capa: string) => {
            const novoItem: PlayItem = {
              id: threadId,
              titulo: titulo || threadId,
              artista: '',
              capa: capa || '',
              audioSrc: fileUrl,
              categoria: 'musica',
            }
            handleNovoTopico({
              id: threadId,
              item: novoItem,
              fonte: 'upload',
              categoria: 'musicas',
            })
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(['topicos', 'lancar'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSubTab(s)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              subTab === s ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground'
            }`}
          >
            {s === 'topicos' ? '💬 Tópicos' : '🎵 Lançar'}
          </button>
        ))}
      </div>
      <ForumTopicosList topicos={topicos} onSelect={handleSelect} />
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function PlayHomePage() {
  const [activeTab, setActiveTab]     = useState<Tab>('home')
  const [forumTopicos, setForumTopicos] = useState<ForumTopico[]>([])

  const [musicasRows,     setMusicasRows]     = useState<SheetRow[]>([])
  const [musicVideosRows, setMusicVideosRows] = useState<SheetRow[]>([])
  const [videosRows,      setVideosRows]      = useState<SheetRow[]>([])
  const [charts,          setCharts]          = useState<ChartData[]>([])
  const [loading,         setLoading]         = useState(true)
  const [fetchError,      setFetchError]      = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setFetchError(null)
    try {
      const [musicas, musicVideos, videos, chartsData] = await Promise.all([
        fetchMusicas(),
        fetchMusicVideos(),
        fetchVideos(),
        fetchCharts().catch(() => [] as ChartData[]),
      ])

      setMusicasRows(musicas.length         > 0 ? musicas      : musicasMock)
      setMusicVideosRows(musicVideos.length > 0 ? musicVideos  : clipesMock)
      setVideosRows(videos.length           > 0 ? videos       : videosMock)
      setCharts(chartsData.length           > 0 ? chartsData   : chartsMockData)
    } catch (err) {
      console.error('[PlayHomePage] loadData error:', err)
      setFetchError('Erro ao carregar dados. Usando dados locais.')
      setMusicasRows(musicasMock)
      setMusicVideosRows(clipesMock)
      setVideosRows(videosMock)
      setCharts(chartsMockData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeTab
            musicasRows={musicasRows}
            musicVideosRows={musicVideosRows}
            charts={charts}
            loading={loading}
            onTabChange={setActiveTab}
          />
        )
      case 'musicas':
        return <MusicasTab rows={musicasRows} loading={loading} />
      case 'clipes':
        return <ClipesTab rows={musicVideosRows} loading={loading} />
      case 'videos':
        return <VideosTab rows={videosRows} loading={loading} />
      case 'forum':
        return (
          <ForumSection
            topicos={forumTopicos}
            onNovoTopico={(t) => setForumTopicos(prev => [t, ...prev])}
          />
        )
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="size-5 text-primary" />
          <span className="text-sm font-black uppercase tracking-widest">Empire Play</span>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="size-8 grid place-items-center text-muted-foreground disabled:opacity-30 active:text-primary transition-colors"
          aria-label="Atualizar"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {fetchError && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <AlertCircle className="size-3.5 text-yellow-400 flex-shrink-0" />
          <p className="text-[10px] text-yellow-300">{fetchError}</p>
        </div>
      )}

      <div className="flex gap-1 px-4 pb-3 flex-shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              activeTab === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground bg-white/[0.03] border border-white/5'
            }`}
          >
            <Icon className="size-3" />{label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        {renderTab()}
        {IS_DEV_MODE && <TelegramDevTab />}
      </div>
    </div>
  )
}
