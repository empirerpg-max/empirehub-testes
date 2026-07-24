import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Radio, Play, Music, Tv, MessageSquare, Send,
  ChevronRight, Home, Clapperboard, ChevronLeft,
  AlertCircle, PlusCircle,
} from 'lucide-react'
import { usePlay, type PlayItem } from '@/lib/playContext'

// ─── Mocks ────────────────────────────────────────────────────────────────────
import musicasMock from '@/mocks/musicas.json'
import clipesMock from '@/mocks/clipes.json'
import videosMock from '@/mocks/videos.json'
import chartsMock from '@/mocks/charts.json'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'musicas' | 'clipes' | 'videos' | 'forum'
type SheetItem = Record<string, string>

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

export type ChartData = {
  nome: string
  subtitulo: string
  icone: string
  cor: string
  capaDaPlaylist: string
  entries: ChartEntry[]
}

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

function driveThumb(capa: string, size = 300): string {
  if (!capa) return ''
  const id = extractDriveId(capa) || (capa.match(/^[a-zA-Z0-9_-]{20,}$/) ? capa : null)
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`
  return capa
}

function parseDataLancamento(item: SheetItem): number {
  const raw = getField(item, 'Data de lançamento', 'Data de lancamento', 'data_de_lancamento', 'datadelancamento', 'data', 'release_date')
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

function toPlayItemMusica(m: SheetItem): PlayItem {
  const titulo = getField(m, 'nome_da_musica', 'nomedamusica', 'nome_musica', 'nome', 'titulo', 'Nome da música', 'Nome da musica')
  const artista = getField(m, 'act_principal', 'actprincipal', 'artista', 'artist', 'ACT Principal')
  const capa = getField(m, 'capa_da_musica', 'capadamusica', 'capa', 'cover', 'Capa da música')
  const audioSrc = getField(m, 'id_do_arquivo', 'idarquivo', 'id_arquivo', 'arquivo', 'link_do_audio', 'link', 'url')
  const idTopico = getField(m, 'id_do_topico', 'idtopico', 'id')
  const letra = getField(m, 'letra', 'lyrics')
  return { id: idTopico || audioSrc || `musica-${titulo}`, titulo, artista, capa, audioSrc, letra, categoria: 'musica' }
}

function toPlayItem(m: SheetItem, cat: PlayItem['categoria']): PlayItem {
  const titulo = cat === 'musica'
    ? getField(m, 'nome_da_musica', 'nomedamusica', 'nome', 'titulo', 'Nome da Música')
    : getField(m, 'tipo_de_clipe', 'tipodeclipe', 'titulo', 'Nome do Clipe', 'Nome do Vídeo', 'nomedovideo')
  const artista = getField(m, 'act_principal', 'actprincipal', 'artista', 'ACT Principal')
  const capa = getField(m, 'capa_da_musica', 'capadamusica', 'capa', 'cover', 'Capa da Música')
  const audioSrc = getField(m, 'id_do_arquivo', 'idarquivo', 'id_arquivo', 'arquivo', 'link', 'url', 'ID do arquivo')
  const idTopico = getField(m, 'id_do_topico', 'idtopico', 'id')
  const letra = getField(m, 'letra', 'lyrics')
  return { id: idTopico || audioSrc || `item-${titulo}`, titulo, artista, capa, audioSrc, letra, categoria: cat }
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
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${isActive ? 'bg-primary/10 border border-primary/30' : 'hover:bg-white/[0.04] border border-transparent'}`}
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
  const queue = chart.entries.filter((e) => e.playItem?.audioSrc).map((e) => e.playItem!) as PlayItem[]
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

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function HomeTab({
  musicasDB, playMusicVideosDB, charts, loading, onTabChange,
}: {
  musicasDB: SheetItem[]; playMusicVideosDB: SheetItem[]
  charts: ChartData[]; loading: boolean
  onTabChange: (t: Tab) => void
}) {
  const [openChart, setOpenChart] = useState<ChartData | null>(null)
  const [homeSection, setHomeSection] = useState<'charts' | 'lancamentos'>('charts')

  const lancMusicas = useMemo<{ item: PlayItem; rawDate: string }[]>(
    () => [...musicasDB].sort((a,b) => parseDataLancamento(b) - parseDataLancamento(a)).slice(0,5).map((m) => ({
      item: toPlayItemMusica(m),
      rawDate: getField(m, 'Data de lançamento', 'Data de lancamento', 'data_de_lancamento', 'data'),
    })),
    [musicasDB]
  )

  const lancVideos = useMemo<PlayItem[]>(
    () => [...playMusicVideosDB].sort((a,b) => parseDataLancamento(b) - parseDataLancamento(a)).slice(0,5).map((m) => toPlayItem(m, 'musicvideo')),
    [playMusicVideosDB]
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
          {loading ? (<><SkeletonList rows={5} /><SkeletonList rows={5} /></>) : (
            <>
              {lancMusicas.length > 0 && (
                <div>
                  <SectionHeader icon={<Music className="size-4 text-primary" />} title="Últimas Músicas" onMore={() => onTabChange('musicas')} />
                  <div className="space-y-1">
                    {lancMusicas.map(({ item, rawDate }, i) => (
                      <RowTrack key={item.id} item={item} queue={lancMusicas.map(x => x.item)} num={i+1} rawDate={rawDate} />
                    ))}
                  </div>
                </div>
              )}
              {lancVideos.length > 0 && (
                <div>
                  <SectionHeader icon={<Clapperboard className="size-4 text-primary" />} title="Últimos Clipes" onMore={() => onTabChange('clipes')} />
                  <div className="grid grid-cols-2 gap-3">
                    {lancVideos.map((item) => <VideoCard key={item.id} item={item} queue={lancVideos} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

type MusicasSubTab = 'lancamentos' | 'albuns' | 'lancar'
function MusicasTab({ musicasDB, loading }: { musicasDB: SheetItem[]; loading: boolean }) {
  const [subTab, setSubTab] = useState<MusicasSubTab>('lancamentos')
  const SUB_TABS: { id: MusicasSubTab; label: string; icon: React.ElementType }[] = [
    { id: 'lancamentos', label: 'Últimos lançamentos', icon: Music },
    { id: 'albuns', label: 'Álbuns', icon: Music },
    { id: 'lancar', label: 'Lançar', icon: PlusCircle },
  ]
  const lancamentos = useMemo<{ item: PlayItem; rawDate: string }[]>(() =>
    [...musicasDB].sort((a,b) => parseDataLancamento(b)-parseDataLancamento(a)).slice(0,30).map((m) => ({
      item: toPlayItemMusica(m),
      rawDate: getField(m, 'Data de lançamento', 'Data de lancamento', 'data_de_lancamento', 'data'),
    })), [musicasDB]
  )
  if (loading && musicasDB.length === 0) return <SkeletonGrid cols={3} rows={4} />
  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex-shrink-0 transition-all ${subTab === id ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground'}`}>
            <Icon className="size-3" />{label}
          </button>
        ))}
      </div>
      {subTab === 'lancamentos' && (
        lancamentos.length === 0
          ? <p className="text-center text-xs text-muted-foreground py-12 opacity-40">Nenhuma música ainda.</p>
          : <div className="grid grid-cols-3 gap-3">
              {lancamentos.map(({ item, rawDate }) => (
                <SongCardWithDate key={item.id} item={item} queue={lancamentos.map(x=>x.item)} rawDate={rawDate} />
              ))}
            </div>
      )}
      {subTab === 'albuns' && (
        <p className="text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum álbum ainda.</p>
      )}
      {subTab === 'lancar' && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="size-16 rounded-full bg-primary/10 grid place-items-center"><PlusCircle className="size-8 text-primary/60" /></div>
          <div>
            <p className="text-sm font-black uppercase tracking-tight">Lançar música</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[24ch]">Em breve você poderá submeter suas músicas aqui.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ClipesTab({ musicVideosDB, loading }: { musicVideosDB: SheetItem[]; loading: boolean }) {
  const [subTab, setSubTab] = useState<'novos' | 'top'>('novos')
  const novos = useMemo<PlayItem[]>(() => [...musicVideosDB].sort((a,b) => parseDataLancamento(b)-parseDataLancamento(a)).map((m) => toPlayItem(m, 'musicvideo')), [musicVideosDB])
  const top = useMemo<PlayItem[]>(() => [...musicVideosDB].sort((a,b) => (parseInt(getField(b,'weeks_video','weeksvideo'))||0)-(parseInt(getField(a,'weeks_video','weeksvideo'))||0)).map((m) => toPlayItem(m,'musicvideo')), [musicVideosDB])
  const list = subTab === 'novos' ? novos : top
  if (loading) return <SkeletonGrid cols={2} rows={3} />
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(['novos','top'] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${subTab===t ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground'}`}>
            {t === 'novos' ? 'Lançamentos' : 'Top Clipes'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {list.map((item) => <VideoCard key={item.id} item={item} queue={list} />)}
      </div>
    </div>
  )
}

function VideosTab({ videosDB, loading }: { videosDB: SheetItem[]; loading: boolean }) {
  const list = useMemo<PlayItem[]>(() => [...videosDB].sort((a,b) => parseDataLancamento(b)-parseDataLancamento(a)).map((m) => toPlayItem(m,'video')), [videosDB])
  if (loading) return <SkeletonGrid cols={2} rows={3} />
  return (
    <div className="grid grid-cols-2 gap-3">
      {list.length === 0
        ? <p className="col-span-2 text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum vídeo ainda.</p>
        : list.map((item) => <VideoCard key={item.id} item={item} queue={list} />)}
    </div>
  )
}

type Comentario = { nome: string; texto: string }
function ForumTopicoDetalhe({ item, onBack }: { item: PlayItem; onBack: () => void }) {
  const [comentarios] = useState<Comentario[]>([
    { nome: 'Anônimo', texto: 'Que faixa incrível! 🔥' },
    { nome: 'Empire Fan', texto: 'Melhor lançamento do mês!' },
  ])
  const [nome, setNome] = useState('')
  const [texto, setTexto] = useState('')
  const { play } = usePlay()
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors">
        <ChevronLeft className="size-4" /> Tópicos
      </button>
      <div className="flex items-start gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-[1.5rem]">
        <div className="size-14 rounded-2xl overflow-hidden bg-primary/10 flex-shrink-0 grid place-items-center">
          <Music className="size-5 text-primary/40" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm truncate uppercase tracking-tight">{item.titulo}</p>
          <button onClick={() => play(item, [item], { autoPlay: true })} className="mt-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1">
            <Play className="size-3" fill="currentColor" /> Tocar
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {comentarios.map((c, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-1">{c.nome}</p>
            <p className="text-xs text-foreground/80">{c.texto}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="h-10 flex-[0.4] bg-white/5 border border-white/10 rounded-2xl px-3 text-xs font-bold uppercase tracking-tight outline-none focus:border-primary/40" />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comentar..." className="h-10 flex-1 bg-white/5 border border-white/10 rounded-2xl px-3 text-xs font-bold outline-none focus:border-primary/40" />
        <button className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center" aria-label="Enviar"><Send className="size-4" /></button>
      </div>
    </div>
  )
}

function ForumTab({ musicasDB, musicVideosDB, videosDB }: { musicasDB: SheetItem[]; musicVideosDB: SheetItem[]; videosDB: SheetItem[] }) {
  const [cat, setCat] = useState<'musicas' | 'musicvideos' | 'videos'>('musicas')
  const [detalhe, setDetalhe] = useState<PlayItem | null>(null)
  const list = useMemo<PlayItem[]>(() => {
    if (cat === 'musicas') return musicasDB.map((m) => toPlayItem(m, 'musica'))
    if (cat === 'musicvideos') return musicVideosDB.map((m) => toPlayItem(m, 'musicvideo'))
    return videosDB.map((m) => toPlayItem(m, 'video'))
  }, [cat, musicasDB, musicVideosDB, videosDB])
  if (detalhe) return <ForumTopicoDetalhe item={detalhe} onBack={() => setDetalhe(null)} />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(['musicas','musicvideos','videos'] as const).map((t) => (
          <button key={t} onClick={() => { setCat(t); setDetalhe(null) }}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${cat===t ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground'}`}>
            {t === 'musicas' ? 'Músicas' : t === 'musicvideos' ? 'Clipes' : 'Vídeos'}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.length === 0
          ? <p className="text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum tópico.</p>
          : list.map((item) => (
            <button key={item.id} onClick={() => setDetalhe(item)}
              className="w-full flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-[1.5rem] active:border-primary/30 transition-colors text-left">
              <div className="size-10 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0 grid place-items-center">
                <Music className="size-4 text-primary/40" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-xs truncate uppercase tracking-tight">{item.titulo || '—'}</p>
              </div>
              <MessageSquare className="size-4 text-muted-foreground/40 flex-shrink-0" />
            </button>
          ))
        }
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PlayHomePage() {
  // Carrega dados dos mocks locais (substitui fetch da API)
  const musicasDB = musicasMock as unknown as SheetItem[]
  const musicVideosDB = clipesMock as unknown as SheetItem[]
  const videosDB = videosMock as unknown as SheetItem[]
  const loading = false

  // Monta charts a partir do mock
  const charts = useMemo<ChartData[]>(() =>
    (chartsMock as Array<{ aba: string; nome: string; subtitulo: string; icone: string; cor: string; entries: Array<{ posicao: number; titulo: string; capa: string; audioSrc: string; artista: string }> }>).map((c) => ({
      nome: c.nome,
      subtitulo: c.subtitulo,
      icone: c.icone,
      cor: c.cor,
      capaDaPlaylist: c.entries[0]?.capa ?? '',
      entries: c.entries.map((e) => ({
        posicao: e.posicao,
        titulo: e.titulo,
        capa: e.capa,
        playItem: {
          id: `chart-${e.posicao}-${c.aba}`,
          titulo: e.titulo,
          artista: e.artista,
          capa: e.capa,
          audioSrc: e.audioSrc,
          categoria: 'musica' as const,
        },
      })),
    })),
  [])

  const [activeTab, setActiveTab] = useState<Tab>('home')
  const tabsRef = useRef<HTMLDivElement>(null)

  const handleTabChange = (t: Tab) => {
    setActiveTab(t)
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <main className="flex-1 pb-40">
      {/* Header */}
      <div className="px-4 pt-6 pb-6" style={{ background: 'linear-gradient(180deg, oklch(0.22 0.10 280 / 0.55), oklch(0.12 0 0) 100%)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Radio className="size-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Empire Play</p>
        </div>
        <h1 className="text-2xl font-black tracking-tighter">Ouça agora</h1>
        <p className="text-xs text-muted-foreground mt-1">Músicas, clipes e vídeos do universo Empire</p>
      </div>

      {/* Tabs sticky */}
      <div ref={tabsRef} className="sticky top-0 z-30 bg-background/90 border-b border-white/[0.06]" style={{ backdropFilter: 'blur(20px) saturate(160%)' }}>
        <div className="flex items-stretch overflow-x-auto scrollbar-hide px-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id
            return (
              <button key={id} onClick={() => handleTabChange(id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-[11px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground active:text-foreground'}`}>
                <Icon className="size-3.5" strokeWidth={active ? 2.5 : 2} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-6">
        {activeTab === 'home' && <HomeTab musicasDB={musicasDB} playMusicVideosDB={musicVideosDB} charts={charts} loading={loading} onTabChange={handleTabChange} />}
        {activeTab === 'musicas' && <MusicasTab musicasDB={musicasDB} loading={loading} />}
        {activeTab === 'clipes' && <ClipesTab musicVideosDB={musicVideosDB} loading={loading} />}
        {activeTab === 'videos' && <VideosTab videosDB={videosDB} loading={loading} />}
        {activeTab === 'forum' && <ForumTab musicasDB={musicasDB} musicVideosDB={musicVideosDB} videosDB={videosDB} />}
      </div>
    </main>
  )
}
