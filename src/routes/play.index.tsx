// ============================================================
// play.index.tsx — rota /play/ (React Router DOM v6)
// Fixes aplicados:
//   1. Removido @tanstack/react-router (não instalado) — usa react-router-dom
//   2. ChartEntry.playItem agora tipado como PlayItem (não optional) no processChart
//   3. Cast do mock removido — import dinâmico removido em produção (dados reais via GAS)
// ============================================================
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Radio,
  Play,
  Music,
  Tv,
  MessageSquare,
  Send,
  ChevronRight,
  Home,
  Clapperboard,
  ChevronLeft,
  AlertCircle,
  PlusCircle,
  Upload,
  CheckCircle2,
  Loader2,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { usePlay, type PlayItem } from "@/lib/playContext";

// ─── API URLs ──────────────────────────────────────────────────────────────
const API_URL =
  "https://script.google.com/macros/s/AKfycby1S1mIBXdj4hLqc9RYv1ZJjL7d5ct6to18FNPmpJn1KOnZrYCKJKPNe2LP0dPW-G8HOg/exec";

const SHEET_ID = "1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo";

function sheetCsvUrl(aba: string): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(aba)}`;
}

// ─── Configuração dos Charts ───────────────────────────────────────────────
const CHARTS_CONFIG = [
  {
    aba: "Top_50_Spotify",
    nome: "Spotify",
    subtitulo: "Top 100 Global Spotify",
    icone: "🟢",
    cor: "text-green-400",
    isVideo: false,
    maxEntries: 100,
  },
  {
    aba: "Top_Songs_Apple_Music",
    nome: "Apple Music",
    subtitulo: "Top Songs Apple Music",
    icone: "🎵",
    cor: "text-red-400",
    isVideo: false,
    maxEntries: 100,
  },
  {
    aba: "Top_Videos_YT",
    nome: "YouTube",
    subtitulo: "Top Videos",
    icone: "📹",
    cor: "text-red-500",
    isVideo: true,
    maxEntries: 100,
  },
] as const;

type Tab = "home" | "musicas" | "clipes" | "videos" | "forum";
type SheetItem = Record<string, string>;

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "home",    label: "Início",  icon: Home },
  { id: "musicas", label: "Músicas",  icon: Music },
  { id: "clipes",  label: "Clipes",   icon: Clapperboard },
  { id: "videos",  label: "Vídeos",  icon: Tv },
  { id: "forum",   label: "Fórum",   icon: MessageSquare },
];

// Fix: playItem é sempre definido em entradas válidas do chart.
// O campo é opcional apenas para satisfazer o filter type-guard abaixo.
export type ChartEntry = {
  posicao: number;
  titulo: string;
  capa: string;
  playItem?: PlayItem;
};

export type ChartData = {
  nome: string;
  subtitulo: string;
  icone: string;
  cor: string;
  capaDaPlaylist: string;
  entries: ChartEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function norm(s: string) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getField(
  item: Record<string, string>,
  ...aliases: string[]
): string {
  if (!item) return "";
  const keys = Object.keys(item);
  const normKeys = keys.map((k) => ({ orig: k, norm: norm(k) }));
  for (const alias of aliases) {
    const target = norm(alias);
    const found = normKeys.find((k) => k.norm === target);
    if (found && item[found.orig] != null && item[found.orig] !== "") return item[found.orig];
  }
  return "";
}

function extractDriveId(str: string): string | null {
  if (!str) return null;
  const m = String(str).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(str).match(/id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (!/^https?:\/\//.test(str) && !str.includes("/") && str.length > 10) return str.trim();
  return null;
}

function driveThumb(capa: string, size = 300): string {
  if (!capa) return "";
  const id = extractDriveId(capa) || (capa.match(/^[a-zA-Z0-9_-]{20,}$/) ? capa : null);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`;
  return capa;
}

function resolveThumb(item: SheetItem, size = 300): string {
  const thumbUrl = getField(item, "thumbnail_url", "thumbnailurl", "thumb", "thumbnail");
  if (thumbUrl && thumbUrl.startsWith("http")) return thumbUrl;
  const capa = getField(item, "capa", "cover", "capa_da_musica", "capadamusica");
  return driveThumb(capa, size);
}

function resolveVideoSrc(item: SheetItem): string {
  const fonte = getField(item, "arquivo_fonte", "arquivofonte", "fonte").toLowerCase();
  const tgFileId = getField(item, "telegram_file_id", "telegramfileid", "telegram_id");
  const youtubeUrl = getField(item, "youtube_url", "youtubeurl", "youtube");
  const driveUrl = getField(item, "drive_url", "driveurl", "drive");

  if (fonte === "telegram" && tgFileId) return `tg:${tgFileId}`;
  if (tgFileId) return `tg:${tgFileId}`;
  if (youtubeUrl) {
    const m = youtubeUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || youtubeUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    return youtubeUrl;
  }
  if (driveUrl) return driveUrl;
  return "";
}

function parseDataLancamento(item: SheetItem): number {
  const raw = getField(
    item,
    "Data de lançamento",
    "Data de lancamento",
    "data_de_lancamento",
    "datadelancamento",
    "data_lancamento",
    "datalancamento",
    "data_upload",
    "dataupload",
    "data",
    "release_date",
    "releasedate",
  );
  if (!raw || raw.trim() === "") return 0;

  const s = raw.trim();

  const brDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brDate) {
    const iso = `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`;
    const t = new Date(iso).getTime();
    return isNaN(t) ? 0 : t;
  }

  const isoLike = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoLike) {
    const t = new Date(isoLike[1]).getTime();
    return isNaN(t) ? 0 : t;
  }

  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n < 1e12 ? n * 1000 : n;
  }

  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const day   = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year  = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function toPlayItemMusica(m: SheetItem): PlayItem {
  const idTopico = getField(m,
    "id_do_topico", "idtopico", "id_topico",
    "ID do tópico", "ID do topico", "id",
  );

  const titulo = getField(m,
    "nome_da_musica", "nomedamusica", "nome_musica", "nomemusica", "nome", "titulo", "title",
    "Nome da música", "Nome da musica", "Nome da Música", "track", "song",
  );

  const artista = getField(m,
    "act_principal", "actprincipal", "id_do_criador", "iddocriador", "idcriador",
    "artista", "artist", "autor", "author",
    "ACT Principal", "ID do Criador", "ID do criador",
  );

  const capa = getField(m,
    "capa_da_musica", "capadamusica", "capa", "cover", "thumb", "thumbnail",
    "Capa da música", "Capa da musica", "Capa da Música",
  );

  const audioSrc = getField(m,
    "id_do_arquivo", "idarquivo", "id_arquivo", "arquivo",
    "link_do_audio", "linkdoaudio", "link", "url", "audio",
    "ID do arquivo", "ID do Arquivo",
  );

  const letra = getField(m,
    "letra", "lyrics", "Letra",
  );

  return {
    id: idTopico || audioSrc || `musica-${titulo}`,
    titulo,
    artista,
    capa,
    audioSrc,
    letra,
    categoria: "musica",
  };
}

function toPlayItemVideo(m: SheetItem): PlayItem {
  const id = getField(m, "id", "telegram_topic_id", "telegramtopicid");
  const titulo = getField(m, "titulo", "title", "nome", "name");
  const artista = getField(m, "artista", "artist", "enviado_por", "enviadopor");
  const audioSrc = resolveVideoSrc(m);
  const capa = resolveThumb(m, 400);
  const tipoVideo = getField(m, "tipo_video", "tipovideo", "tipo").toLowerCase();

  let categoria: PlayItem["categoria"] = "video";
  if (tipoVideo === "musicvideo") categoria = "musicvideo";

  return {
    id: id || audioSrc || `video-${titulo}`,
    titulo,
    artista,
    capa,
    audioSrc,
    letra: getField(m, "descricao", "description", "desc"),
    categoria,
  };
}

function toPlayItem(m: SheetItem, cat: PlayItem["categoria"]): PlayItem {
  const idTopico = getField(m,
    "id_do_topico", "idtopico", "id_topico", "id",
    "ID do tópico", "ID do topico",
  );

  const titulo =
    cat === "musica"
      ? getField(m,
          "nome_da_musica", "nomedamusica", "nome_musica", "nome", "titulo", "title",
          "Nome da Música", "Nome da musica", "Música", "musica", "track", "song",
        )
      : getField(m,
          "tipo_de_clipe", "tipodeclipe", "tipo", "titulo", "title",
          "nome_do_clipe", "nomedoclipe",
          "Tipo de Clipe", "Nome do Clipe", "Nome do Vídeo", "nome do video",
          "nomedovideo", "clipe", "video",
        );

  const artista = getField(m,
    "act_principal", "actprincipal", "act principal",
    "artista", "artist",
    "ACT Principal", "Act Principal",
    "Artista", "Artista Principal",
    "ID do criador", "iddocriador",
    "autor", "author",
  );

  const capa = getField(m,
    "capa_da_musica", "capadamusica", "capa", "cover",
    "Capa da Música", "Capa da musica",
    "Thumb", "thumb", "thumbnail",
  );

  const audioSrc = getField(m,
    "id_do_arquivo", "idarquivo", "id_arquivo", "arquivo",
    "ID do Arquivo", "ID do arquivo",
    "Link do áudio", "Link do audio",
    "Link", "link", "url", "URL",
    "ID do vídeo", "ID do video", "idvideo", "id_video",
    "youtube_id", "youtubeid",
    "audio", "Audio",
  );

  const letra = getField(m, "letra", "lyrics", "Letra");

  return {
    id: idTopico || audioSrc || `item-${titulo}`,
    titulo,
    artista,
    capa,
    audioSrc,
    letra,
    categoria: cat,
  };
}

function sheetRowsToObjects(values: string[][]): SheetItem[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim());
  return values.slice(1).map((row) => {
    const obj: SheetItem = {};
    headers.forEach((h, i) => { obj[h] = String(row[i] ?? "").trim(); });
    return obj;
  });
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cols.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

async function fetchSheetValues(aba: string): Promise<{ values: string[][]; error?: string }> {
  try {
    const res = await fetch(sheetCsvUrl(aba));
    if (!res.ok) {
      return { values: [], error: `HTTP ${res.status} ao buscar aba "${aba}"` };
    }
    const csv = await res.text();
    const parsed = parseCSV(csv);
    if (parsed.length > 1) return { values: parsed };
    return { values: [], error: `CSV vazio para aba "${aba}"` };
  } catch (e) {
    return { values: [], error: String(e) };
  }
}

function processChart(
  chartValues: string[][],
  isVideo: boolean,
  maxEntries = 100
): { entries: ChartEntry[]; capaDaPlaylist: string } {
  if (!chartValues || chartValues.length < 2) return { entries: [], capaDaPlaylist: "" };

  const rows = sheetRowsToObjects(chartValues);

  const entries: ChartEntry[] = rows
    .map((row) => {
      const posStr = getField(row, "Posição", "Posicao", "Pos", "position", "rank");
      const posicao = parseInt(posStr.replace(/\D/g, "")) || 0;

      const titulo = isVideo
        ? getField(row, "Nome do vídeo", "Nome do video", "nomedovideo", "titulo", "title")
        : getField(row, "Nome da música", "Nome da musica", "nomedamusica", "titulo", "title", "nome");

      const capa = isVideo
        ? getField(row, "Thumb", "thumb", "thumbnail", "capa", "Capa da música", "Capa da musica")
        : getField(row, "Capa da música", "Capa da musica", "capadamusica", "capa", "cover");

      const idTopico  = getField(row, "ID do tópico", "ID do topico", "idtopico", "id");
      const linkAudio = getField(row, "Link do áudio", "Link do audio", "linkdoaudio", "link", "audio", "url");
      const criador   = getField(row, "ID do criador", "iddocriador", "criador", "artista", "artist");

      if (!posicao || !titulo) return null;

      // Fix L416: playItem é sempre construído aqui; acesso seguro garantido
      const playItem: PlayItem = {
        id: idTopico || `chart-${posicao}`,
        titulo,
        artista: criador,
        capa,
        audioSrc: linkAudio,
        letra: "",
        categoria: isVideo ? "musicvideo" : "musica",
      };

      return { posicao, titulo, capa, playItem } satisfies ChartEntry;
    })
    .filter((e): e is ChartEntry => e !== null && e.posicao > 0)
    .sort((a, b) => a.posicao - b.posicao)
    .slice(0, maxEntries);

  return { entries, capaDaPlaylist: entries[0]?.capa ?? "" };
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
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
  );
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
  );
}

// ─── Card Components ───────────────────────────────────────────────────────
function SongCard({ item, queue }: { item: PlayItem; queue: PlayItem[] }) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;
  return (
    <button onClick={() => play(item, queue, { autoPlay: true })} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-primary/10 ${isActive ? "ring-2 ring-primary" : ""} transition-all`}>
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
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : ""}`}>{item.titulo || "—"}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
      </div>
    </button>
  );
}

function SongCardWithDate({
  item,
  queue,
  rawDate,
}: {
  item: PlayItem;
  queue: PlayItem[];
  rawDate: string;
}) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;

  const { dataFormatada, isNovo } = useMemo(() => {
    if (!rawDate || rawDate.trim() === "") return { dataFormatada: "", isNovo: false };
    const s = rawDate.trim();

    let ts = 0;

    const brDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brDate) {
      const iso = `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`;
      ts = new Date(iso).getTime();
    } else if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      ts = n < 1e12 ? n * 1000 : n;
    } else {
      ts = new Date(s).getTime();
    }

    if (!ts || isNaN(ts)) return { dataFormatada: "", isNovo: false };

    const diffDias = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return {
      dataFormatada: formatDate(ts),
      isNovo: diffDias <= 30,
    };
  }, [rawDate]);

  return (
    <button
      onClick={() => play(item, queue, { autoPlay: true })}
      className="flex flex-col gap-2 text-left group w-full"
    >
      <div
        className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-primary/10 ${
          isActive ? "ring-2 ring-primary" : ""
        } transition-all`}
      >
        {item.capa ? (
          <img
            src={driveThumb(item.capa, 300)}
            alt={item.titulo}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Music className="size-8 text-primary/40" />
          </div>
        )}
        {isNovo && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest">
            Novo
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 grid place-items-center">
          <div className="size-10 rounded-full bg-primary/0 group-active:bg-primary/90 grid place-items-center transition-all">
            <Play className="size-5 text-white opacity-0 group-active:opacity-100" fill="white" />
          </div>
        </div>
        {isActive && (
          <div className="absolute bottom-2 left-2 flex gap-0.5 items-end">
            {[3, 5, 4].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-bounce"
                style={{ height: `${h * 3}px`, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p
          className={`text-xs font-black truncate uppercase tracking-tight ${
            isActive ? "text-primary" : ""
          }`}
        >
          {item.titulo || "—"}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
        {dataFormatada && (
          <p className="text-[9px] text-muted-foreground/50 truncate mt-0.5">
            Lançada em {dataFormatada}
          </p>
        )}
      </div>
    </button>
  );
}

function VideoCard({ item, queue }: { item: PlayItem; queue: PlayItem[] }) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;
  const thumbSrc = item.capa
    ? item.capa.startsWith("http")
      ? item.capa
      : driveThumb(item.capa, 400)
    : "";
  return (
    <button onClick={() => play(item, queue, { autoPlay: true })} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative w-full rounded-2xl overflow-hidden bg-primary/10 aspect-video ${isActive ? "ring-2 ring-primary" : ""} transition-all`}>
        {thumbSrc ? (
          <img src={thumbSrc} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
            {[3, 5, 4].map((h, i) => (
              <div key={i} className="w-1 bg-primary rounded-full animate-bounce" style={{ height: `${h * 3}px`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : ""}`}>{item.titulo || "—"}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
      </div>
    </button>
  );
}

function RowTrack({
  item,
  queue,
  num,
  rawDate,
}: {
  item: PlayItem;
  queue: PlayItem[];
  num: number;
  rawDate?: string;
}) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;

  const dataFormatada = useMemo(() => {
    if (!rawDate || rawDate.trim() === "") return "";
    const s = rawDate.trim();

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;

    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      const ts = n < 1e12 ? n * 1000 : n;
      return formatDate(ts);
    }

    const isoLike = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoLike) {
      const t = new Date(isoLike[1]).getTime();
      return isNaN(t) ? s : formatDate(t);
    }

    const t = new Date(s).getTime();
    return isNaN(t) ? s : formatDate(t);
  }, [rawDate]);

  return (
    <button
      onClick={() => play(item, queue, { autoPlay: true })}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${
        isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <div className="size-5 flex-shrink-0 grid place-items-center">
        {isActive ? (
          <div className="flex gap-0.5 items-end">
            {[3, 5, 4].map((h, i) => (
              <div key={i} className="w-0.5 bg-primary rounded-full animate-bounce" style={{ height: `${h * 2}px`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : (
          <span className="text-[10px] font-black text-muted-foreground/50">{num}</span>
        )}
      </div>
      <div className="size-10 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
        {item.capa ? (
          <img src={item.capa.startsWith("http") ? item.capa : driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Music className="size-4 text-primary/30" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : ""}`}>{item.titulo || "—"}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {item.artista}
          {dataFormatada && (
            <span className="ml-1.5 opacity-50">· {dataFormatada}</span>
          )}
        </p>
      </div>
      <Play className="size-4 text-muted-foreground/40 flex-shrink-0" fill="currentColor" />
    </button>
  );
}

function ChartRow({ entry, queue }: { entry: ChartEntry; queue: PlayItem[] }) {
  const { play, state } = usePlay();
  // Fix L416: playItem pode ser undefined (filtro garante mas TS não sabe)
  const isActive =
    entry.playItem != null &&
    state.currentIdx !== null &&
    state.queue[state.currentIdx]?.id === entry.playItem.id;
  const canPlay = !!entry.playItem?.audioSrc;

  return (
    <button
      onClick={() => { if (entry.playItem) play(entry.playItem, queue, { autoPlay: true }); }}
      disabled={!canPlay}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${
        isActive
          ? "bg-primary/10 border border-primary/30"
          : canPlay
          ? "border border-transparent active:bg-white/[0.04]"
          : "border border-transparent opacity-60 cursor-default"
      }`}
    >
      <div className="w-5 flex-shrink-0 text-center">
        {isActive ? (
          <div className="flex gap-0.5 items-end justify-center">
            {[3, 5, 4].map((h, i) => (
              <div key={i} className="w-0.5 bg-primary rounded-full animate-bounce" style={{ height: `${h * 2}px`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : (
          <span className={`text-[10px] font-black ${entry.posicao <= 3 ? "text-primary" : "text-muted-foreground/50"}`}>
            {entry.posicao}
          </span>
        )}
      </div>
      <div className="size-10 rounded-xl overflow-hidden bg-white/[0.05] flex-shrink-0">
        {entry.capa ? (
          <img src={entry.capa.startsWith("http") ? entry.capa : driveThumb(entry.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Music className="size-4 text-white/10" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : canPlay ? "" : "text-muted-foreground"}`}>
          {entry.titulo}
        </p>
      </div>
    </button>
  );
}

function SectionHeader({ icon, title, onMore }: { icon: React.ReactNode; title: string; onMore?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
        {icon}{title}
      </h2>
      {onMore && (
        <button onClick={onMore} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1 active:text-primary transition-colors">
          Ver tudo <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}

function ChartMiniCard({ chart, onOpen }: { chart: ChartData; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem] overflow-hidden active:border-primary/30 transition-all"
    >
      <div className="relative w-full aspect-square bg-white/[0.05] grid place-items-center">
        {chart.capaDaPlaylist ? (
          <img src={chart.capaDaPlaylist.startsWith("http") ? chart.capaDaPlaylist : driveThumb(chart.capaDaPlaylist, 300)} alt={chart.nome} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span className="text-5xl">{chart.icone}</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[11px] font-black text-white leading-tight">{chart.subtitulo}</p>
        </div>
      </div>
    </button>
  );
}

function ChartDetailView({ chart, onBack }: { chart: ChartData; onBack: () => void }) {
  const queue = chart.entries
    .filter((e): e is ChartEntry & { playItem: PlayItem } => e.playItem != null && !!e.playItem.audioSrc)
    .map((e) => e.playItem);
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors">
        <ChevronLeft className="size-4" /> Charts
      </button>
      <div className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem]">
        <div className="size-16 rounded-2xl overflow-hidden bg-white/[0.05] flex-shrink-0">
          {chart.capaDaPlaylist ? (
            <img src={chart.capaDaPlaylist.startsWith("http") ? chart.capaDaPlaylist : driveThumb(chart.capaDaPlaylist, 120)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="w-full h-full grid place-items-center"><span className="text-3xl">{chart.icone}</span></div>
          )}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{chart.icone} {chart.nome}</p>
          <p className="text-base font-black tracking-tight">{chart.subtitulo}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{chart.entries.length} faixas</p>
        </div>
      </div>
      <div className="space-y-0.5">
        {chart.entries.map((entry) => (
          <ChartRow key={entry.posicao} entry={entry} queue={queue} />
        ))}
      </div>
    </div>
  );
}

// ─── Formulário de Lançamento ─────────────────────────────────────────────
type FonteMidia = "youtube" | "drive" | "telegram" | "outra";
type StatusForm = "idle" | "loading" | "success" | "error";

const FONTE_CONFIG: Record<FonteMidia, { label: string; placeholder: string; hint: string }> = {
  youtube: {
    label: "URL ou ID do YouTube",
    placeholder: "https://www.youtube.com/watch?v=... ou dQw4w9WgXcQ",
    hint: "Cole o link completo do YouTube ou apenas o ID do vídeo.",
  },
  drive: {
    label: "URL ou ID do Google Drive",
    placeholder: "https://drive.google.com/file/d/... ou 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs",
    hint: "Cole o link de compartilhamento ou o ID do arquivo no Drive.",
  },
  telegram: {
    label: "file_id do Telegram",
    placeholder: "BQACAgIAAxkBAAI...",
    hint: "Cole o file_id retornado pelo bot do Telegram.",
  },
  outra: {
    label: "URL da mídia",
    placeholder: "https://...",
    hint: "Cole a URL direta da mídia.",
  },
};

interface FormLancarState {
  titulo: string;
  tipoSingle: string;
  tipoMusica: string;
  artistas: string[];
  substituir: "Sim" | "Nao" | "";
  musicaSubstituida: string;
  fonte: FonteMidia;
  urlOuFileId: string;
}

const FORM_INITIAL: FormLancarState = {
  titulo: "",
  tipoSingle: "",
  tipoMusica: "",
  artistas: [""],
  substituir: "",
  musicaSubstituida: "",
  fonte: "youtube",
  urlOuFileId: "",
};

function LancarTab() {
  const [form, setForm] = useState<FormLancarState>(FORM_INITIAL);
  const [status, setStatus] = useState<StatusForm>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = <K extends keyof FormLancarState>(key: K, val: FormLancarState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const setArtista = (idx: number, val: string) =>
    setForm((prev) => {
      const next = [...prev.artistas];
      next[idx] = val;
      return { ...prev, artistas: next };
    });

  const addArtista = () =>
    setForm((prev) => ({ ...prev, artistas: [...prev.artistas, ""] }));

  const removeArtista = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      artistas: prev.artistas.length > 1 ? prev.artistas.filter((_, i) => i !== idx) : prev.artistas,
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const artistas = form.artistas.map((a) => a.trim()).filter(Boolean);

    const payload = {
      action: "gravarMusica",
      titulo: form.titulo.trim(),
      tipoSingle: form.tipoSingle,
      tipoMusica: form.tipoMusica,
      artistas,
      substituir: form.substituir,
      musicaSubstituida: form.substituir === "Sim" ? form.musicaSubstituida.trim() : "",
      fonte: form.fonte,
      urlOuFileId: form.urlOuFileId.trim(),
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.success || data?.status === "ok") {
        setStatus("success");
        setForm(FORM_INITIAL);
      } else {
        throw new Error(data?.message || data?.error || "Resposta inesperada do servidor.");
      }
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const inputCls =
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:bg-primary/[0.04] transition-all";

  const labelCls = "block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5";

  const selectCls =
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:bg-primary/[0.04] transition-all appearance-none";

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-12 text-center">
        <div className="size-16 rounded-full bg-primary/10 border border-primary/20 grid place-items-center">
          <CheckCircle2 className="size-8 text-primary" />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-widest">Lançamento enviado!</p>
          <p className="text-[11px] text-muted-foreground mt-1">Sua música foi registrada com sucesso.</p>
        </div>
        <button
          onClick={() => setStatus("idle")}
          className="px-6 py-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-[11px] font-black uppercase tracking-widest text-primary active:bg-primary/20 transition-all"
        >
          Lançar outra
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-6">
      <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-[1.5rem]">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">📝 Cadastrar Música</p>
        <p className="text-[11px] text-muted-foreground/60">Preencha os dados do lançamento. Será registrado via Empire GAS.</p>
      </div>

      {/* Título */}
      <div>
        <label className={labelCls}>Título da música *</label>
        <input
          required
          type="text"
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Nome do lançamento"
          className={inputCls}
        />
      </div>

      {/* Tipo Single / Tipo Música */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo de single</label>
          <select value={form.tipoSingle} onChange={(e) => set("tipoSingle", e.target.value)} className={selectCls}>
            <option value="">Selecione…</option>
            <option value="Single">Single</option>
            <option value="EP">EP</option>
            <option value="Album">Álbum</option>
            <option value="Mixtape">Mixtape</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Tipo de música</label>
          <select value={form.tipoMusica} onChange={(e) => set("tipoMusica", e.target.value)} className={selectCls}>
            <option value="">Selecione…</option>
            <option value="Original">Original</option>
            <option value="Cover">Cover</option>
            <option value="Remix">Remix</option>
            <option value="Instrumental">Instrumental</option>
          </select>
        </div>
      </div>

      {/* Artistas */}
      <div>
        <label className={labelCls}>Artistas</label>
        <div className="space-y-2">
          {form.artistas.map((a, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={a}
                onChange={(e) => setArtista(idx, e.target.value)}
                placeholder={`Artista ${idx + 1}`}
                className={inputCls}
              />
              {form.artistas.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeArtista(idx)}
                  className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-muted-foreground active:text-red-400 transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addArtista}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors"
          >
            <Plus className="size-3" /> Adicionar artista
          </button>
        </div>
      </div>

      {/* Substituir */}
      <div>
        <label className={labelCls}>Substitui outra música?</label>
        <div className="flex gap-2">
          {(["Sim", "Nao"] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => set("substituir", op)}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${
                form.substituir === op
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/[0.03] border-white/[0.08] text-muted-foreground"
              }`}
            >
              {op === "Sim" ? "Sim" : "Não"}
            </button>
          ))}
        </div>
        {form.substituir === "Sim" && (
          <input
            type="text"
            value={form.musicaSubstituida}
            onChange={(e) => set("musicaSubstituida", e.target.value)}
            placeholder="Nome da música substituída"
            className={`${inputCls} mt-2`}
          />
        )}
      </div>

      {/* Fonte da Mídia */}
      <div>
        <label className={labelCls}>Fonte da mídia</label>
        <div className="flex gap-2 flex-wrap mb-3">
          {(Object.keys(FONTE_CONFIG) as FonteMidia[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => set("fonte", f)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                form.fonte === f
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/[0.03] border-white/[0.08] text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={form.urlOuFileId}
          onChange={(e) => set("urlOuFileId", e.target.value)}
          placeholder={FONTE_CONFIG[form.fonte].placeholder}
          className={inputCls}
        />
        <p className="text-[10px] text-muted-foreground/50 mt-1.5">{FONTE_CONFIG[form.fonte].hint}</p>
      </div>

      {/* Erro */}
      {status === "error" && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300">{errorMsg}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "loading" || !form.titulo || !form.urlOuFileId}
        className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {status === "loading" ? (
          <><Loader2 className="size-4 animate-spin" /> Enviando…</>
        ) : (
          <><Upload className="size-4" /> Enviar lançamento</>
        )}
      </button>
    </form>
  );
}

// ─── Fórum ────────────────────────────────────────────────────────────────
function ForumTab() {
  const [msg, setMsg] = useState("");
  const [msgs, setMsgs] = useState<{ id: number; text: string; ts: number }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = () => {
    if (!msg.trim()) return;
    setMsgs((prev) => [...prev, { id: Date.now(), text: msg.trim(), ts: Date.now() }]);
    setMsg("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)]">
      <div className="flex-1 overflow-y-auto space-y-2 py-2">
        {msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <MessageSquare className="size-10 text-muted-foreground/20" />
            <p className="text-[11px] text-muted-foreground/50">Nenhuma mensagem ainda.<br/>Seja o primeiro a comentar!</p>
          </div>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] bg-primary/20 border border-primary/30 rounded-2xl rounded-tr-sm px-3 py-2">
                <p className="text-xs">{m.text}</p>
                <p className="text-[9px] text-muted-foreground/50 mt-0.5 text-right">
                  {new Date(m.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Escreva uma mensagem…"
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-all"
        />
        <button
          onClick={send}
          disabled={!msg.trim()}
          className="size-10 rounded-2xl bg-primary disabled:opacity-30 grid place-items-center transition-all active:scale-95"
        >
          <Send className="size-4 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────
export default function PlayHomePage() {
  const [tab, setTab] = useState<Tab>("home");

  // Dados das abas principais
  const [musicas, setMusicas] = useState<SheetItem[]>([]);
  const [clipes, setClipes] = useState<SheetItem[]>([]);
  const [videos, setVideos] = useState<SheetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charts
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<ChartData | null>(null);

  // Carrega abas principais
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [mRes, cRes, vRes] = await Promise.all([
          fetchSheetValues("Musicas"),
          fetchSheetValues("Music Videos"),
          fetchSheetValues("Videos"),
        ]);
        if (!cancelled) {
          setMusicas(sheetRowsToObjects(mRes.values));
          setClipes(sheetRowsToObjects(cRes.values));
          setVideos(sheetRowsToObjects(vRes.values));
          if (mRes.error && cRes.error && vRes.error) {
            setError("Não foi possível carregar os dados. Verifique sua conexão.");
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Carrega charts
  useEffect(() => {
    let cancelled = false;
    async function loadCharts() {
      setChartsLoading(true);
      try {
        const results = await Promise.all(
          CHARTS_CONFIG.map((c) => fetchSheetValues(c.aba))
        );
        if (!cancelled) {
          const built: ChartData[] = CHARTS_CONFIG.map((cfg, i) => {
            const { entries, capaDaPlaylist } = processChart(results[i].values, cfg.isVideo, cfg.maxEntries);
            return {
              nome: cfg.nome,
              subtitulo: cfg.subtitulo,
              icone: cfg.icone,
              cor: cfg.cor,
              capaDaPlaylist,
              entries,
            };
          });
          setCharts(built);
        }
      } finally {
        if (!cancelled) setChartsLoading(false);
      }
    }
    loadCharts();
    return () => { cancelled = true; };
  }, []);

  // Converte para PlayItem
  const musicasPlay = useMemo(() => musicas.map(toPlayItemMusica), [musicas]);
  const clipesPlay  = useMemo(() => clipes.map((m) => toPlayItem(m, "musicvideo")), [clipes]);
  const videosPlay  = useMemo(() => videos.map(toPlayItemVideo), [videos]);

  const recentes = useMemo(() => {
    const all = [
      ...musicas.map((m) => ({ item: toPlayItemMusica(m), ts: parseDataLancamento(m) })),
      ...clipes.map((m)  => ({ item: toPlayItem(m, "musicvideo"), ts: parseDataLancamento(m) })),
    ];
    return all
      .filter((x) => x.ts > 0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 8);
  }, [musicas, clipes]);

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-background text-foreground pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <div className="size-8 rounded-xl bg-primary/20 border border-primary/30 grid place-items-center flex-shrink-0">
          <Radio className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-black uppercase tracking-widest truncate">Empire Play</h1>
          <p className="text-[10px] text-muted-foreground truncate">
            {musicas.length + clipes.length + videos.length > 0
              ? `${musicas.length} músicas · ${clipes.length} clipes · ${videos.length} vídeos`
              : loading ? "Carregando…" : "Empire RPG"}
          </p>
        </div>
        <button
          onClick={() => setTab("forum")}
          className="size-8 rounded-xl bg-white/[0.04] border border-white/[0.08] grid place-items-center text-muted-foreground active:text-primary transition-colors"
        >
          <PlusCircle className="size-4" />
        </button>
      </header>

      {/* Tab Content */}
      <main className="px-4 pt-4">
        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300">{error}</p>
          </div>
        )}

        {/* HOME */}
        {tab === "home" && (
          <div className="space-y-8">
            {/* Recentes */}
            <section>
              <SectionHeader icon={<Radio className="size-3.5" />} title="Recentes" onMore={() => setTab("musicas")} />
              {loading ? <SkeletonGrid cols={3} rows={2} /> : (
                <div className="grid grid-cols-3 gap-3">
                  {recentes.slice(0, 6).map(({ item, ts }) => (
                    <SongCardWithDate key={item.id} item={item} queue={recentes.map((r) => r.item)} rawDate={String(ts)} />
                  ))}
                </div>
              )}
            </section>

            {/* Charts */}
            <section>
              <SectionHeader icon={<span className="text-xs">🏆</span>} title="Charts" />
              {chartsLoading ? <SkeletonGrid cols={3} rows={1} /> : (
                activeChart ? (
                  <ChartDetailView chart={activeChart} onBack={() => setActiveChart(null)} />
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {charts.map((c) => (
                      <ChartMiniCard key={c.nome} chart={c} onOpen={() => setActiveChart(c)} />
                    ))}
                  </div>
                )
              )}
            </section>

            {/* Músicas */}
            {musicasPlay.length > 0 && (
              <section>
                <SectionHeader icon={<Music className="size-3.5" />} title="Músicas" onMore={() => setTab("musicas")} />
                {loading ? <SkeletonGrid cols={3} rows={2} /> : (
                  <div className="grid grid-cols-3 gap-3">
                    {musicasPlay.slice(0, 6).map((item) => (
                      <SongCard key={item.id} item={item} queue={musicasPlay} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Clipes */}
            {clipesPlay.length > 0 && (
              <section>
                <SectionHeader icon={<Clapperboard className="size-3.5" />} title="Clipes" onMore={() => setTab("clipes")} />
                {loading ? <SkeletonGrid cols={2} rows={2} /> : (
                  <div className="grid grid-cols-2 gap-3">
                    {clipesPlay.slice(0, 4).map((item) => (
                      <VideoCard key={item.id} item={item} queue={clipesPlay} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* MÚSICAS */}
        {tab === "musicas" && (
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
              {musicasPlay.length} faixas
            </p>
            {loading ? <SkeletonList rows={8} /> : (
              musicasPlay.length > 0
                ? musicasPlay.map((item, i) => (
                    <RowTrack
                      key={item.id}
                      item={item}
                      queue={musicasPlay}
                      num={i + 1}
                      rawDate={getField(musicas[i] ?? {}, "Data de lançamento", "data_lancamento", "data")}
                    />
                  ))
                : <div className="py-12 text-center text-[11px] text-muted-foreground/50">Nenhuma música encontrada.</div>
            )}
          </div>
        )}

        {/* CLIPES */}
        {tab === "clipes" && (
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {clipesPlay.length} clipes
            </p>
            {loading ? <SkeletonGrid cols={2} rows={3} /> : (
              clipesPlay.length > 0
                ? <div className="grid grid-cols-2 gap-3">
                    {clipesPlay.map((item) => (
                      <VideoCard key={item.id} item={item} queue={clipesPlay} />
                    ))}
                  </div>
                : <div className="py-12 text-center text-[11px] text-muted-foreground/50">Nenhum clipe encontrado.</div>
            )}
          </div>
        )}

        {/* VÍDEOS */}
        {tab === "videos" && (
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {videosPlay.length} vídeos
            </p>
            {loading ? <SkeletonGrid cols={2} rows={3} /> : (
              videosPlay.length > 0
                ? <div className="grid grid-cols-2 gap-3">
                    {videosPlay.map((item) => (
                      <VideoCard key={item.id} item={item} queue={videosPlay} />
                    ))}
                  </div>
                : <div className="py-12 text-center text-[11px] text-muted-foreground/50">Nenhum vídeo encontrado.</div>
            )}
          </div>
        )}

        {/* FÓRUM */}
        {tab === "forum" && <ForumTab />}

        {/* LANÇAR */}
        {tab === "forum" && (
          <div className="mt-8 pt-8 border-t border-white/[0.06]">
            <SectionHeader icon={<Upload className="size-3.5" />} title="Lançar Música" />
            <LancarTab />
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-white/[0.06]">
        <div className="flex items-stretch h-16">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                tab === id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" />
              <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
