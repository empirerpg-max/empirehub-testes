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

function parseDataLancamento(item: SheetItem): number {
  const raw = getField(
    item,
    "Data de lançamento",
    "Data de lancamento",
    "data_de_lancamento",
    "datadelancamento",
    "data_lancamento",
    "datalancamento",
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
  return (
    <button onClick={() => play(item, queue, { autoPlay: true })} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative w-full rounded-2xl overflow-hidden bg-primary/10 aspect-video ${isActive ? "ring-2 ring-primary" : ""} transition-all`}>
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
          <img src={driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
          <img src={driveThumb(entry.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
            <img src={driveThumb(chart.capaDaPlaylist, 120)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
                    {lancVideos.map((item) => <VideoCard key={item.id} item={item} queue={lancVideos} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Tipos do formulário de lançamento ────────────────────────────────────
type FonteMidia = "youtube" | "drive" | "telegram" | "outra";

interface LancarMusicaForm {
  titulo: string;
  tipoSingle: string;
  tipoMusica: string;
  artistas: string;         // campo livre; serializado como array no submit
  substituir: "Sim" | "Não";
  musicaSubstituida: string;
  fonte: FonteMidia;
  urlOuFileId: string;
}

const INITIAL_FORM: LancarMusicaForm = {
  titulo: "",
  tipoSingle: "",
  tipoMusica: "",
  artistas: "",
  substituir: "Não",
  musicaSubstituida: "",
  fonte: "youtube",
  urlOuFileId: "",
};

const FONTE_META: Record<FonteMidia, { label: string; placeholder: string; hint: string }> = {
  youtube:  { label: "URL do YouTube",      placeholder: "https://www.youtube.com/watch?v=...",  hint: "Cole o link completo do vídeo/música no YouTube" },
  drive:    { label: "ID do Google Drive",  placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74O",  hint: "Cole o ID do arquivo no Google Drive (não o link completo)" },
  telegram: { label: "File ID do Telegram", placeholder: "AgACAgIAAxkBAAI...",                    hint: "Cole o file_id retornado pelo bot do Telegram" },
  outra:    { label: "URL / Identificador", placeholder: "https://...",                            hint: "Cole qualquer URL ou identificador acessível" },
};

type SubmitStatus = "idle" | "loading" | "success" | "error";

// ─── Formulário de lançamento ──────────────────────────────────────────────
function LancarMusicaFormComponent() {
  const [form, setForm] = useState<LancarMusicaForm>(INITIAL_FORM);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set<K extends keyof LancarMusicaForm>(key: K, value: LancarMusicaForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setStatus("idle");
    setErrorMsg("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    // Constrói payload compatível com action=gravarMusica do GAS legado
    const artistasArray = form.artistas
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const payload = {
      action: "gravarMusica",
      titulo: form.titulo.trim(),
      tipoSingle: form.tipoSingle.trim(),
      tipoMusica: form.tipoMusica.trim(),
      artistas: artistasArray,
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

      // GAS retorna 200 mesmo em erros lógicos — verificamos o body
      const text = await res.text();
      let json: { status?: string; error?: string; message?: string } = {};
      try { json = JSON.parse(text); } catch { /* GAS às vezes retorna texto puro */ }

      if (!res.ok || json.status === "error") {
        throw new Error(json.error || json.message || `HTTP ${res.status}`);
      }

      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  const fonteMeta = FONTE_META[form.fonte];

  // ── Estado de sucesso ──────────────────────────────────────────────────
  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="size-16 rounded-full bg-green-500/15 grid place-items-center">
          <CheckCircle2 className="size-8 text-green-400" />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-tight">Enviado com sucesso!</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[26ch]">
            "{form.titulo}" foi registrado e será processado em breve.
          </p>
        </div>
        <button
          onClick={resetForm}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest"
        >
          Lançar outra
        </button>
      </div>
    );
  }

  // ── Formulário ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 pb-1">
        <div className="size-10 rounded-2xl bg-primary/15 grid place-items-center flex-shrink-0">
          <Upload className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-tight leading-tight">Lançar Música</p>
          <p className="text-[10px] text-muted-foreground">Preencha os dados e envie para o catálogo</p>
        </div>
      </div>

      {/* Título */}
      <fieldset className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lm-titulo">
          Título da música *
        </label>
        <input
          id="lm-titulo"
          type="text"
          required
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Nome da faixa"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-all"
        />
      </fieldset>

      {/* Tipo Single + Tipo Música (lado a lado) */}
      <div className="grid grid-cols-2 gap-3">
        <fieldset className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lm-tipo-single">
            Tipo de single
          </label>
          <input
            id="lm-tipo-single"
            type="text"
            value={form.tipoSingle}
            onChange={(e) => set("tipoSingle", e.target.value)}
            placeholder="Ex: Single, EP…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-all"
          />
        </fieldset>
        <fieldset className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lm-tipo-musica">
            Tipo de música
          </label>
          <input
            id="lm-tipo-musica"
            type="text"
            value={form.tipoMusica}
            onChange={(e) => set("tipoMusica", e.target.value)}
            placeholder="Ex: Pop, Rap…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-all"
          />
        </fieldset>
      </div>

      {/* Artistas */}
      <fieldset className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lm-artistas">
          Artistas
        </label>
        <input
          id="lm-artistas"
          type="text"
          value={form.artistas}
          onChange={(e) => set("artistas", e.target.value)}
          placeholder="Separe por vírgula: Artista A, Artista B"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-all"
        />
        <p className="text-[9px] text-muted-foreground/50 px-1">Separe múltiplos artistas com vírgula</p>
      </fieldset>

      {/* Substituir */}
      <fieldset className="space-y-2">
        <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Substitui música existente?
        </legend>
        <div className="flex gap-2">
          {(["Não", "Sim"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => set("substituir", opt)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                form.substituir === opt
                  ? "bg-primary text-primary-foreground border-primary shadow-lg"
                  : "border-white/[0.08] text-muted-foreground"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Música substituída (condicional) */}
      {form.substituir === "Sim" && (
        <fieldset className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lm-musica-substituida">
            Música a ser substituída
          </label>
          <input
            id="lm-musica-substituida"
            type="text"
            value={form.musicaSubstituida}
            onChange={(e) => set("musicaSubstituida", e.target.value)}
            placeholder="Nome ou ID da música substituída"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-all"
          />
        </fieldset>
      )}

      {/* Fonte de mídia */}
      <fieldset className="space-y-2">
        <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Fonte da mídia
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FONTE_META) as FonteMidia[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => set("fonte", f)}
              className={`py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                form.fonte === f
                  ? "bg-primary text-primary-foreground border-primary shadow-lg"
                  : "border-white/[0.08] text-muted-foreground"
              }`}
            >
              {f === "youtube" ? "▶ YouTube" : f === "drive" ? "◈ Drive" : f === "telegram" ? "✈ Telegram" : "🔗 Outra"}
            </button>
          ))}
        </div>
      </fieldset>

      {/* URL / File ID dinâmico */}
      <fieldset className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lm-url">
          {fonteMeta.label}
        </label>
        <input
          id="lm-url"
          type="text"
          value={form.urlOuFileId}
          onChange={(e) => set("urlOuFileId", e.target.value)}
          placeholder={fonteMeta.placeholder}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-all font-mono"
        />
        <p className="text-[9px] text-muted-foreground/50 px-1">{fonteMeta.hint}</p>
      </fieldset>

      {/* Erro de envio */}
      {status === "error" && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Erro ao enviar</p>
            <p className="text-[10px] text-red-400/70 mt-0.5 break-all font-mono">{errorMsg}</p>
          </div>
          <button type="button" onClick={() => setStatus("idle")} className="text-red-400/50 active:text-red-400">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "loading" || !form.titulo.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {status === "loading" ? (
          <><Loader2 className="size-4 animate-spin" /> Enviando…</>
        ) : (
          <><Send className="size-4" /> Enviar para o catálogo</>
        )}
      </button>
    </form>
  );
}

type MusicasSubTab = "lancamentos" | "albuns" | "lancar";

function MusicasTab({ musicasDB, loading }: {
  musicasDB: SheetItem[];
  loading: boolean;
}) {
  const [subTab, setSubTab] = useState<MusicasSubTab>("lancamentos");

  const SUB_TABS: { id: MusicasSubTab; label: string; icon: React.ElementType }[] = [
    { id: "lancamentos", label: "Últimos lançamentos", icon: Music },
    { id: "albuns",      label: "Álbuns",              icon: Music },
    { id: "lancar",      label: "Lançar",              icon: PlusCircle },
  ];

  const lancamentos = useMemo<{ item: PlayItem; rawDate: string }[]>(() => {
    return [...musicasDB]
      .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
      .slice(0, 30)
      .map((m) => ({
        item: toPlayItemMusica(m),
        rawDate: getField(
          m,
          "Data de lançamento",
          "Data de lancamento",
          "data_de_lancamento",
          "datadelancamento",
          "data_lancamento",
          "datalancamento",
          "data",
          "release_date",
          "releasedate",
        ),
      }));
  }, [musicasDB]);

  const albuns = useMemo(() => {
    const map: Record<string, { title: string; artist: string; capa: string; faixas: PlayItem[] }> = {};
    musicasDB.forEach((m) => {
      const album = getField(m, "album");
      if (!album) return;
      if (!map[album]) {
        map[album] = {
          title: album,
          artist: getField(m, "act_principal", "actprincipal"),
          capa: getField(m, "capa_da_musica", "capadamusica", "capa", "cover"),
          faixas: [],
        };
      }
      map[album].faixas.push(toPlayItem(m, "musica"));
    });
    return Object.values(map);
  }, [musicasDB]);

  if (loading && musicasDB.length === 0) return <SkeletonGrid cols={3} rows={4} />;

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex-shrink-0 transition-all ${
              subTab === id
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="size-3" />
            {label}
          </button>
        ))}
      </div>

      {subTab === "lancamentos" && (
        <div className="space-y-3">
          {lancamentos.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-12 opacity-40">Nenhuma música ainda.</p>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-black px-1 pb-1">
                {lancamentos.length} músicas · mais recente primeiro
              </p>
              <div className="grid grid-cols-3 gap-3">
                {lancamentos.map(({ item, rawDate }) => (
                  <SongCardWithDate
                    key={item.id}
                    item={item}
                    queue={lancamentos.map((x) => x.item)}
                    rawDate={rawDate}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {subTab === "albuns" && (
        <div className="grid grid-cols-2 gap-3">
          {albuns.length === 0 ? (
            <p className="col-span-2 text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum álbum ainda.</p>
          ) : (
            albuns.map((a) => (
              <div key={a.title} className="flex flex-col gap-2">
                <div className="aspect-square rounded-2xl overflow-hidden bg-primary/10">
                  {a.capa ? (
                    <img src={driveThumb(a.capa, 300)} alt={a.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full grid place-items-center"><Music className="size-8 text-primary/30" /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate uppercase tracking-tight">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{a.artist}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Sub-aba Lançar: formulário real ────────────────────────────── */}
      {subTab === "lancar" && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-[1.5rem] p-4">
          <LancarMusicaFormComponent />
        </div>
      )}
    </div>
  );
}

function ClipesTab({ musicVideosDB, loading }: { musicVideosDB: SheetItem[]; loading: boolean }) {
  const [subTab, setSubTab] = useState<"novos" | "top">("novos");
  const novos = useMemo<PlayItem[]>(
    () => [...musicVideosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).map((m) => toPlayItem(m, "musicvideo")),
    [musicVideosDB]
  );
  const top = useMemo<PlayItem[]>(
    () => [...musicVideosDB].sort((a, b) => (parseInt(getField(b, "weeks_video", "weeksvideo")) || 0) - (parseInt(getField(a, "weeks_video", "weeksvideo")) || 0)).map((m) => toPlayItem(m, "musicvideo")),
    [musicVideosDB]
  );
  const list = subTab === "novos" ? novos : top;

  if (loading) return <SkeletonGrid cols={2} rows={3} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["novos", "top"] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              subTab === t ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}>
            {t === "novos" ? "Lançamentos" : "Top Clipes"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {list.length === 0
          ? <p className="col-span-2 text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum clipe ainda.</p>
          : list.map((item) => <VideoCard key={item.id} item={item} queue={list} />)
        }
      </div>
    </div>
  );
}

function VideosTab({ videosDB, loading }: { videosDB: SheetItem[]; loading: boolean }) {
  const videos = useMemo<PlayItem[]>(
    () => [...videosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).map((m) => toPlayItem(m, "video")),
    [videosDB]
  );

  if (loading) return <SkeletonGrid cols={2} rows={3} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {videos.length === 0
          ? <p className="col-span-2 text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum vídeo ainda.</p>
          : videos.map((item) => <VideoCard key={item.id} item={item} queue={videos} />)
        }
      </div>
    </div>
  );
}

// ─── Forum ─────────────────────────────────────────────────────────────────
type ForumTopico = {
  id: string;
  titulo: string;
  capa: string;
  artista: string;
  totalComentarios: number;
};

type Comentario = {
  id: string;
  autor: string;
  texto: string;
  dataHora: string;
};

function ForumTopicoDetalhe({
  topico,
  onBack,
}: {
  topico: ForumTopico;
  onBack: () => void;
}) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loadingComents, setLoadingComents] = useState(true);
  const [errorComents, setErrorComents] = useState("");
  const [novoComentario, setNovoComentario] = useState("");
  const [autor, setAutor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [envioOk, setEnvioOk] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingComents(true);
      setErrorComents("");
      try {
        const url = `${API_URL}?action=getComentarios&topicoId=${encodeURIComponent(topico.id)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.comentarios) setComentarios(json.comentarios);
        else setComentarios([]);
      } catch (e) {
        setErrorComents(String(e));
      } finally {
        setLoadingComents(false);
      }
    }
    load();
  }, [topico.id]);

  async function enviarComentario() {
    if (!novoComentario.trim()) return;
    setEnviando(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addComentario",
          topicoId: topico.id,
          autor: autor.trim() || "Anônimo",
          texto: novoComentario.trim(),
        }),
      });
      setEnvioOk(true);
      setNovoComentario("");
      setTimeout(() => setEnvioOk(false), 3000);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors">
        <ChevronLeft className="size-4" /> Fórum
      </button>
      <div className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem]">
        <div className="size-14 rounded-2xl overflow-hidden bg-primary/10 flex-shrink-0">
          {topico.capa
            ? <img src={driveThumb(topico.capa, 100)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            : <div className="w-full h-full grid place-items-center"><Music className="size-6 text-primary/30" /></div>
          }
        </div>
        <div>
          <p className="text-sm font-black tracking-tight">{topico.titulo}</p>
          <p className="text-[10px] text-muted-foreground">{topico.artista}</p>
        </div>
      </div>

      <div className="space-y-2">
        {loadingComents ? (
          <SkeletonList rows={3} />
        ) : errorComents ? (
          <div className="flex gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <AlertCircle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-400/80 font-mono">{errorComents}</p>
          </div>
        ) : comentarios.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8 opacity-40">Nenhum comentário ainda. Seja o primeiro!</p>
        ) : (
          comentarios.map((c) => (
            <div key={c.id} className="p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">{c.autor}</p>
                <p className="text-[9px] text-muted-foreground/40">{c.dataHora}</p>
              </div>
              <p className="text-xs text-muted-foreground">{c.texto}</p>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-white/[0.05]">
        <input
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          placeholder="Seu nome (opcional)"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-all"
        />
        <div className="flex gap-2">
          <input
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
            placeholder="Escreva um comentário…"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-all"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarComentario(); } }}
          />
          <button
            onClick={enviarComentario}
            disabled={enviando || !novoComentario.trim()}
            className="size-10 flex-shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-40 transition-all active:scale-95"
          >
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        {envioOk && <p className="text-[10px] text-green-400 font-black uppercase tracking-widest px-1">✓ Comentário enviado!</p>}
      </div>
    </div>
  );
}

function ForumTab({ musicasDB, loading }: { musicasDB: SheetItem[]; loading: boolean }) {
  const [topicoAberto, setTopicoAberto] = useState<ForumTopico | null>(null);

  const topicos = useMemo<ForumTopico[]>(() => {
    return [...musicasDB]
      .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
      .slice(0, 50)
      .map((m) => {
        const item = toPlayItemMusica(m);
        const totalStr = getField(m, "total_comentarios", "totalcomentarios", "comentarios");
        return {
          id: item.id,
          titulo: item.titulo,
          capa: item.capa,
          artista: item.artista,
          totalComentarios: parseInt(totalStr) || 0,
        };
      })
      .filter((t) => t.titulo);
  }, [musicasDB]);

  if (topicoAberto) return <ForumTopicoDetalhe topico={topicoAberto} onBack={() => setTopicoAberto(null)} />;
  if (loading) return <SkeletonList rows={6} />;

  return (
    <div className="space-y-2">
      {topicos.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum tópico disponível.</p>
      ) : (
        topicos.map((t) => (
          <button
            key={t.id}
            onClick={() => setTopicoAberto(t)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] active:border-primary/30 transition-all text-left"
          >
            <div className="size-12 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
              {t.capa
                ? <img src={driveThumb(t.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                : <div className="w-full h-full grid place-items-center"><Music className="size-5 text-primary/30" /></div>
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black truncate uppercase tracking-tight">{t.titulo}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t.artista}</p>
              {t.totalComentarios > 0 && (
                <p className="text-[9px] text-muted-foreground/50 mt-0.5">{t.totalComentarios} comentário{t.totalComentarios !== 1 ? "s" : ""}</p>
              )}
            </div>
            <MessageSquare className="size-4 text-muted-foreground/30 flex-shrink-0" />
          </button>
        ))
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────
function PlayHomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [musicasDB,        setMusicasDB]        = useState<SheetItem[]>([]);
  const [playMusicVideosDB,setPlayMusicVideosDB] = useState<SheetItem[]>([]);
  const [videosDB,         setVideosDB]          = useState<SheetItem[]>([]);
  const [loading,          setLoading]           = useState(true);
  const [charts,           setCharts]            = useState<ChartData[]>([]);
  const [chartsLoading,    setChartsLoading]     = useState(true);
  const [chartsError,      setChartsError]       = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [m, pmv, v] = await Promise.all([
        fetchSheetValues("Músicas"),
        fetchSheetValues("PlayMusicVideos"),
        fetchSheetValues("Videos"),
      ]);
      setMusicasDB(sheetRowsToObjects(m.values));
      setPlayMusicVideosDB(sheetRowsToObjects(pmv.values));
      setVideosDB(sheetRowsToObjects(v.values));
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadCharts() {
      setChartsLoading(true);
      let errors: string[] = [];
      const results = await Promise.all(
        CHARTS_CONFIG.map(async (cfg) => {
          const { values, error } = await fetchSheetValues(cfg.aba);
          if (error) errors.push(`${cfg.nome}: ${error}`);
          const { entries, capaDaPlaylist } = processChart(values, cfg.isVideo, cfg.maxEntries);
          return { nome: cfg.nome, subtitulo: cfg.subtitulo, icone: cfg.icone, cor: cfg.cor, capaDaPlaylist, entries };
        })
      );
      setCharts(results.filter((r) => r.entries.length > 0));
      if (errors.length) setChartsError(errors.join(" | "));
      setChartsLoading(false);
    }
    loadCharts();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-2">
        <Radio className="size-5 text-primary flex-shrink-0" />
        <span className="text-sm font-black uppercase tracking-widest">Empire Play</span>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 px-4 py-5 pb-32">
        {activeTab === "home"    && <HomeTab musicasDB={musicasDB} playMusicVideosDB={playMusicVideosDB} charts={charts} chartsLoading={chartsLoading} chartsError={chartsError} loading={loading} onTabChange={setActiveTab} />}
        {activeTab === "musicas" && <MusicasTab musicasDB={musicasDB} loading={loading} />}
        {activeTab === "clipes"  && <ClipesTab musicVideosDB={playMusicVideosDB} loading={loading} />}
        {activeTab === "videos"  && <VideosTab videosDB={videosDB} loading={loading} />}
        {activeTab === "forum"   && <ForumTab musicasDB={musicasDB} loading={loading} />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-white/[0.06] px-2 pb-safe">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center gap-1 py-3 px-3 transition-all ${
                activeTab === id ? "text-primary" : "text-muted-foreground"
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
