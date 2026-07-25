import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/play/")(  {
  component: PlayHomePage,
  head: () => ({
    meta: [
      { title: "Empire Play • Empire Hub" },
      { property: "og:title", content: "Empire Play • Empire Hub" },
      { property: "og:description", content: "Ouça as músicas, clipes e vídeos do Empire RPG." },
    ],
  }),
});


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

/**
 * Resolve a URL da thumbnail de um item de vídeo.
 * Prioridade: thumbnail_url direta → drive thumb → vazia
 */
function resolveThumb(item: SheetItem, size = 300): string {
  const thumbUrl = getField(item, "thumbnail_url", "thumbnailurl", "thumb", "thumbnail");
  if (thumbUrl && thumbUrl.startsWith("http")) return thumbUrl;
  const capa = getField(item, "capa", "cover", "capa_da_musica", "capadamusica");
  return driveThumb(capa, size);
}

/**
 * Monta o audioSrc correto para um item de vídeo da aba Videos.
 * Se arquivo_fonte = "telegram" usa tg:FILE_ID
 * Se tiver youtube_url usa o id do YouTube
 * Se tiver drive_url usa o drive id
 */
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

  // formato "2025-01-04 13:50:41"
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

/** Converte uma linha da aba "Videos" (com telegram_file_id) em PlayItem */
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

      const playItem: PlayItem = {
        id: idTopico || `chart-${posicao}`,
        titulo,
        artista: criador,
        capa,
        audioSrc: linkAudio,
        letra: "",
        categoria: isVideo ? "musicvideo" : "musica",
      };

      return { posicao, titulo, capa, playItem } as ChartEntry;
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
  // thumb pode ser URL direta (Telegram bot) ou Drive
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

    // "2025-01-04 13:50:41"
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
  const isActive =
    entry.playItem && state.currentIdx !== null && state.queue[state.currentIdx]?.id === entry.playItem.id;
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
  const queue = chart.entries.filter((e) => e.playItem?.audioSrc).map((e) => e.playItem!) as PlayItem[];
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
            <option value="Acustico">Acústico</option>
          </select>
        </div>
      </div>

      {/* Artistas */}
      <div>
        <label className={labelCls}>Artistas *</label>
        <div className="space-y-2">
          {form.artistas.map((art, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                required={idx === 0}
                type="text"
                value={art}
                onChange={(e) => setArtista(idx, e.target.value)}
                placeholder={idx === 0 ? "ACT principal" : "Feat / collab"}
                className={`${inputCls} flex-1`}
              />
              {form.artistas.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeArtista(idx)}
                  className="size-11 flex-shrink-0 rounded-2xl bg-white/[0.04] border border-white/[0.08] grid place-items-center text-muted-foreground active:text-red-400 active:border-red-400/30 transition-all"
                  aria-label="Remover artista"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addArtista}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors py-1"
          >
            <Plus className="size-3.5" /> Adicionar feat
          </button>
        </div>
      </div>

      {/* Substituir */}
      <div>
        <label className={labelCls}>Esta música substitui outra?</label>
        <div className="grid grid-cols-3 gap-2">
          {([["", "Não sei"], ["Nao", "Não"], ["Sim", "Sim"]] as [string, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => set("substituir", val as FormLancarState["substituir"])}
              className={`py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                form.substituir === val
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-white/[0.03] border-white/[0.06] text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Música Substituída */}
      {form.substituir === "Sim" && (
        <div>
          <label className={labelCls}>Nome da música substituída *</label>
          <input
            required
            type="text"
            value={form.musicaSubstituida}
            onChange={(e) => set("musicaSubstituida", e.target.value)}
            placeholder="Título exato da música anterior"
            className={inputCls}
          />
        </div>
      )}

      {/* Fonte de mídia */}
      <div>
        <label className={labelCls}>Fonte da mídia *</label>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {(["youtube", "drive", "telegram", "outra"] as FonteMidia[]).map((f) => {
            const icons: Record<FonteMidia, string> = { youtube: "▶", drive: "◈", telegram: "✈", outra: "⊕" };
            return (
              <button
                key={f}
                type="button"
                onClick={() => { set("fonte", f); set("urlOuFileId", ""); }}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                  form.fonte === f
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-white/[0.03] border-white/[0.06] text-muted-foreground"
                }`}
              >
                <span className="text-base">{icons[f]}</span>
                {f === "outra" ? "Outra" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            );
          })}
        </div>
        <div>
          <label className={labelCls}>{FONTE_CONFIG[form.fonte].label} *</label>
          <input
            required
            type="text"
            value={form.urlOuFileId}
            onChange={(e) => set("urlOuFileId", e.target.value)}
            placeholder={FONTE_CONFIG[form.fonte].placeholder}
            className={inputCls}
          />
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 px-1">{FONTE_CONFIG[form.fonte].hint}</p>
        </div>
      </div>

      {/* Erro inline */}
      {status === "error" && (
        <div className="flex gap-2.5 p-3.5 bg-red-500/[0.06] border border-red-500/20 rounded-2xl">
          <AlertCircle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-black text-red-400">Erro ao enviar</p>
            <p className="text-[10px] text-red-400/70 mt-0.5 font-mono break-all">{errorMsg}</p>
          </div>
          <button type="button" onClick={() => setStatus("idle")} className="ml-auto">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 active:bg-primary/80 transition-all"
      >
        {status === "loading" ? (
          <><Loader2 className="size-4 animate-spin" /> Enviando…</>
        ) : (
          <><Upload className="size-4" /> Lançar música</>
        )}
      </button>
    </form>
  );
}

function HomeTab({
  musicasDB,
  playMusicVideosDB,
  charts,
  chartsLoading,
  chartsError,
  loading,
  onTabChange,
}: {
  musicasDB: SheetItem[];
  playMusicVideosDB: SheetItem[];
  charts: ChartData[];
  chartsLoading: boolean;
  chartsError: string;
  loading: boolean;
  onTabChange: (t: Tab) => void;
}) {
  const [openChart, setOpenChart] = useState<ChartData | null>(null);
  const [homeSection, setHomeSection] = useState<"charts" | "lancamentos">("charts");

  const lancMusicas = useMemo<{ item: PlayItem; rawDate: string }[]>(
    () =>
      [...musicasDB]
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .slice(0, 5)
        .map((m) => ({
          item: toPlayItemMusica(m),
          rawDate: getField(
            m,
            "Data de lançamento", "Data de lancamento", "data_de_lancamento",
            "datadelancamento", "data_lancamento", "datalancamento",
            "data", "release_date", "releasedate",
          ),
        })),
    [musicasDB]
  );

  const lancVideos = useMemo<PlayItem[]>(
    () =>
      [...playMusicVideosDB]
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .slice(0, 5)
        .map((m) => toPlayItem(m, "musicvideo")),
    [playMusicVideosDB]
  );

  if (openChart) return <ChartDetailView chart={openChart} onBack={() => setOpenChart(null)} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["charts", "lancamentos"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setHomeSection(s)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              homeSection === s ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}
          >
            {s === "charts" ? "🏆 Top Charts" : "✨ Lançamentos"}
          </button>
        ))}
      </div>

      {homeSection === "charts" && (
        <section className="space-y-4">
          <SectionHeader icon={<span>🏆</span>} title="Top Charts" />
          {chartsLoading ? (
            <SkeletonGrid cols={3} rows={1} />
          ) : charts.length === 0 ? (
            <div className="space-y-3">
              <p className="text-center text-xs text-muted-foreground py-4 opacity-40">
                Nenhum chart disponível no momento.
              </p>
              {chartsError && (
                <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-3 flex gap-2">
                  <AlertCircle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400/80 font-mono break-all">{chartsError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {charts.map((c) => (
                <ChartMiniCard key={c.nome} chart={c} onOpen={() => setOpenChart(c)} />
              ))}
            </div>
          )}
        </section>
      )}

      {homeSection === "lancamentos" && (
        <section className="space-y-6">
          {loading ? (
            <><SkeletonList rows={5} /><SkeletonList rows={5} /></>
          ) : (
            <>
              {lancMusicas.length > 0 && (
                <div>
                  <SectionHeader
                    icon={<Music className="size-4 text-primary" />}
                    title="Últimas Músicas"
                    onMore={() => onTabChange("musicas")}
                  />
                  <div className="space-y-1">
                    {lancMusicas.map(({ item, rawDate }, i) => (
                      <RowTrack
                        key={item.id}
                        item={item}
                        queue={lancMusicas.map((x) => x.item)}
                        num={i + 1}
                        rawDate={rawDate}
                      />
                    ))}
                  </div>
                </div>
              )}
              {lancVideos.length > 0 && (
                <div>
                  <SectionHeader
                    icon={<Clapperboard className="size-4 text-primary" />}
                    title="Últimos Clipes"
                    onMore={() => onTabChange("clipes")}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    {lancVideos.map((item) => (
                      <VideoCard key={item.id} item={item} queue={lancVideos} />
                    ))}
                  </div>
                </div>
              )}
              {lancMusicas.length === 0 && lancVideos.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8 opacity-40">Nenhum lançamento recente.</p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Fórum ─────────────────────────────────────────────────────────────────
type TopicoForum = {
  id: string;
  titulo: string;
  mensagens: number;
  ultimaMsg: string;
  threadId?: string;
};

type Comentario = {
  id: string;
  autor: string;
  texto: string;
  data: string;
};

function ForumTopicoDetalhe({
  topico,
  onBack,
}: {
  topico: TopicoForum;
  onBack: () => void;
}) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loadingComs, setLoadingComs] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingComs(true);
    fetch(`${API_URL}?action=getComentarios&topicoId=${topico.id}`)
      .then((r) => r.json())
      .then((d) => setComentarios(Array.isArray(d) ? d : d?.comentarios ?? []))
      .catch(() => {})
      .finally(() => setLoadingComs(false));
  }, [topico.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comentarios]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addComentario",
          topicoId: topico.id,
          threadId: topico.threadId,
          texto: texto.trim(),
        }),
      });
      setTexto("");
      const d = await fetch(`${API_URL}?action=getComentarios&topicoId=${topico.id}`).then((r) => r.json());
      setComentarios(Array.isArray(d) ? d : d?.comentarios ?? []);
    } catch {}
    setEnviando(false);
  };

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors mb-4"
      >
        <ChevronLeft className="size-4" /> Fórum
      </button>
      <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem] mb-4">
        <p className="text-xs font-black uppercase tracking-tight">{topico.titulo}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{topico.mensagens} mensagens</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto mb-4">
        {loadingComs ? (
          <SkeletonList rows={3} />
        ) : comentarios.length === 0 ? (
          <p className="text-center text-[11px] text-muted-foreground/50 py-6">Nenhum comentário ainda. Seja o primeiro!</p>
        ) : (
          comentarios.map((c) => (
            <div key={c.id} className="p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-primary/80">{c.autor}</span>
                <span className="text-[9px] text-muted-foreground/50">{c.data}</span>
              </div>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{c.texto}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviar()}
          placeholder="Escreva um comentário…"
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-all"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="size-12 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center text-primary disabled:opacity-40 active:bg-primary/20 transition-all flex-shrink-0"
        >
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function ForumTab() {
  const [topicos, setTopicos] = useState<TopicoForum[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTopico, setOpenTopico] = useState<TopicoForum | null>(null);

  useEffect(() => {
    fetch(`${API_URL}?action=getTopicos`)
      .then((r) => r.json())
      .then((d) => setTopicos(Array.isArray(d) ? d : d?.topicos ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (openTopico)
    return <ForumTopicoDetalhe topico={openTopico} onBack={() => setOpenTopico(null)} />;

  return (
    <div className="space-y-3">
      <SectionHeader icon={<MessageSquare className="size-4 text-primary" />} title="Fórum" />
      {loading ? (
        <SkeletonList rows={4} />
      ) : topicos.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8 opacity-40">Nenhum tópico disponível.</p>
      ) : (
        topicos.map((t) => (
          <button
            key={t.id}
            onClick={() => setOpenTopico(t)}
            className="w-full flex items-center gap-3 p-3.5 bg-white/[0.03] border border-white/[0.05] rounded-2xl active:border-primary/30 transition-all text-left"
          >
            <div className="size-10 rounded-xl bg-primary/10 grid place-items-center flex-shrink-0">
              <MessageSquare className="size-4 text-primary/60" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-tight truncate">{t.titulo}</p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{t.ultimaMsg}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-[9px] text-muted-foreground/50">{t.mensagens}</span>
              <ChevronRight className="size-3 text-muted-foreground/40" />
            </div>
          </button>
        ))
      )}
    </div>
  );
}

// ─── Aba Músicas ───────────────────────────────────────────────────────────
type MusicasSubTab = "lancamentos" | "albuns" | "lancar";

const MUSICAS_SUBTABS: { id: MusicasSubTab; label: string }[] = [
  { id: "lancamentos", label: "Lançamentos" },
  { id: "albuns",      label: "Álbuns" },
  { id: "lancar",      label: "Lançar" },
];

function MusicasTab({
  musicasDB,
  loading,
}: {
  musicasDB: SheetItem[];
  loading: boolean;
}) {
  const [subTab, setSubTab] = useState<MusicasSubTab>("lancamentos");

  const sorted = useMemo(
    () => [...musicasDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)),
    [musicasDB]
  );

  const playItems = useMemo(() => sorted.map(toPlayItemMusica), [sorted]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {MUSICAS_SUBTABS.map((st) => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              subTab === st.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground"
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === "lancamentos" && (
        <div className="space-y-1">
          {loading ? (
            <SkeletonList rows={6} />
          ) : sorted.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8 opacity-40">Nenhuma música cadastrada.</p>
          ) : (
            sorted.map((m, i) => (
              <RowTrack
                key={playItems[i].id}
                item={playItems[i]}
                queue={playItems}
                num={i + 1}
                rawDate={getField(
                  m,
                  "Data de lançamento", "Data de lancamento", "data_de_lancamento",
                  "datadelancamento", "data_lancamento", "datalancamento",
                  "data", "release_date", "releasedate",
                )}
              />
            ))
          )}
        </div>
      )}

      {subTab === "albuns" && (
        <div className="space-y-3">
          <SectionHeader icon={<Music className="size-4 text-primary" />} title="Álbuns" />
          {loading ? (
            <SkeletonGrid cols={2} rows={2} />
          ) : (
            <p className="text-center text-xs text-muted-foreground py-8 opacity-40">Álbuns em breve.</p>
          )}
        </div>
      )}

      {subTab === "lancar" && <LancarTab />}
    </div>
  );
}

// ─── Aba Clipes (Music Videos da aba Empire_Play_Music_Videos) ─────────────
function ClipesTab({
  playMusicVideosDB,
  loading,
}: {
  playMusicVideosDB: SheetItem[];
  loading: boolean;
}) {
  const sorted = useMemo(
    () => [...playMusicVideosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)),
    [playMusicVideosDB]
  );
  const playItems = useMemo(() => sorted.map((m) => toPlayItem(m, "musicvideo")), [sorted]);

  return (
    <div className="space-y-4">
      <SectionHeader icon={<Clapperboard className="size-4 text-primary" />} title="Clipes" />
      {loading ? (
        <SkeletonGrid cols={2} rows={3} />
      ) : playItems.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8 opacity-40">Nenhum clipe disponível.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {playItems.map((item) => (
            <VideoCard key={item.id} item={item} queue={playItems} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Aba Vídeos (aba "Videos" — Telegram file_id) ──────────────────────────
function VideosTab({
  videosDB,
  loading,
}: {
  videosDB: SheetItem[];
  loading: boolean;
}) {
  const [filtro, setFiltro] = useState<"todos" | "musicvideo" | "video">("todos");

  const allItems = useMemo(
    () =>
      [...videosDB]
        .filter((m) => {
          const status = getField(m, "status").toLowerCase();
          // só exibe itens prontos (ready_telegram ou sem status)
          return status === "" || status === "ready_telegram" || status === "ready";
        })
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .map(toPlayItemVideo),
    [videosDB]
  );

  const filtered = useMemo(() => {
    if (filtro === "todos") return allItems;
    return allItems.filter((item) => item.categoria === filtro);
  }, [allItems, filtro]);

  return (
    <div className="space-y-4">
      <SectionHeader icon={<Tv className="size-4 text-primary" />} title="Vídeos" />

      {/* Filtro */}
      <div className="flex gap-1.5 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {([
          ["todos", "Todos"],
          ["musicvideo", "Music Videos"],
          ["video", "Outros"],
        ] as [string, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFiltro(val as typeof filtro)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              filtro === val
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonGrid cols={2} rows={3} />
      ) : filtered.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8 opacity-40">Nenhum vídeo disponível.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((item) => (
            <VideoCard key={item.id} item={item} queue={filtered} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
function PlayHomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");

  // ── dados carregados UMA vez e nunca resetados ao trocar de aba ──
  const [musicasDB, setMusicasDB] = useState<SheetItem[]>([]);
  const [playMusicVideosDB, setPlayMusicVideosDB] = useState<SheetItem[]>([]);
  const [videosDB, setVideosDB] = useState<SheetItem[]>([]);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSheetValues("Empire_Play"),
      fetchSheetValues("Empire_Play_Music_Videos"),
      // aba se chama "Videos" dentro da planilha Empire_Play
      fetchSheetValues("Videos"),
    ]).then(([musicas, pmv, videos]) => {
      setMusicasDB(sheetRowsToObjects(musicas.values));
      setPlayMusicVideosDB(sheetRowsToObjects(pmv.values));
      setVideosDB(sheetRowsToObjects(videos.values));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setChartsLoading(true);
    let errAcc = "";
    Promise.all(
      CHARTS_CONFIG.map((c) =>
        fetchSheetValues(c.aba).then((r) => {
          if (r.error) errAcc += r.error + " ";
          return { config: c, values: r.values };
        })
      )
    ).then((results) => {
      const built: ChartData[] = results
        .map(({ config, values }) => {
          const { entries, capaDaPlaylist } = processChart(values, config.isVideo, config.maxEntries);
          if (entries.length === 0) return null;
          return {
            nome: config.nome,
            subtitulo: config.subtitulo,
            icone: config.icone,
            cor: config.cor,
            capaDaPlaylist,
            entries,
          } as ChartData;
        })
        .filter((c): c is ChartData => c !== null);
      setCharts(built);
      setChartsError(errAcc.trim());
      setChartsLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex items-center gap-2 px-4 py-3 bg-background/80 backdrop-blur border-b border-white/[0.06]">
        <Radio className="size-5 text-primary" />
        <span className="text-sm font-black uppercase tracking-widest">Empire Play</span>
      </header>

      {/* ── Conteúdo da aba ativa ── */}
      <main className="flex-1 px-4 py-5 pb-32 overflow-y-auto">
        {/* Renderiza TODAS as abas mas só mostra a ativa — evita reset de estado ao navegar */}
        <div className={activeTab === "home" ? "block" : "hidden"}>
          <HomeTab
            musicasDB={musicasDB}
            playMusicVideosDB={playMusicVideosDB}
            charts={charts}
            chartsLoading={chartsLoading}
            chartsError={chartsError}
            loading={loading}
            onTabChange={setActiveTab}
          />
        </div>
        <div className={activeTab === "musicas" ? "block" : "hidden"}>
          <MusicasTab musicasDB={musicasDB} loading={loading} />
        </div>
        <div className={activeTab === "clipes" ? "block" : "hidden"}>
          <ClipesTab playMusicVideosDB={playMusicVideosDB} loading={loading} />
        </div>
        <div className={activeTab === "videos" ? "block" : "hidden"}>
          <VideosTab videosDB={videosDB} loading={loading} />
        </div>
        <div className={activeTab === "forum" ? "block" : "hidden"}>
          <ForumTab />
        </div>
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 flex items-center bg-background/90 backdrop-blur border-t border-white/[0.06] pb-safe">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === id ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-5" />
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
