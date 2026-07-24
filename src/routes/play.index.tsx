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
} from "lucide-react";
import { usePlay, type PlayItem } from "@/lib/playContext";

export const Route = createFileRoute("/play/")({
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

      {subTab === "lancar" && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="size-16 rounded-full bg-primary/10 grid place-items-center">
            <PlusCircle className="size-8 text-primary/60" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-tight">Lançar música</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[24ch]">
              Em breve você poderá submeter suas músicas aqui.
            </p>
          </div>
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
        {list.map((item) => <VideoCard key={item.id} item={item} queue={list} />)}
      </div>
    </div>
  );
}

function VideosTab({ videosDB, loading }: { videosDB: SheetItem[]; loading: boolean }) {
  const list = useMemo<PlayItem[]>(
    () => [...videosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).map((m) => toPlayItem(m, "video")),
    [videosDB]
  );
  if (loading) return <SkeletonGrid cols={2} rows={3} />;
  return (
    <div className="grid grid-cols-2 gap-3">
      {list.length === 0
        ? <p className="col-span-2 text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum vídeo ainda.</p>
        : list.map((item) => <VideoCard key={item.id} item={item} queue={list} />)
      }
    </div>
  );
}

type Comentario = { nome: string; texto: string };

function ForumTopicoDetalhe({ item, categoria, onBack }: { item: PlayItem; categoria: string; onBack: () => void }) {
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!item.id) return;
    fetch(`${API_URL}?action=getComentarios&id=${encodeURIComponent(item.id)}`)
      .then((r) => r.json())
      .then((data) => setComentarios(Array.isArray(data) ? data : []))
      .catch(() => setComentarios([]));
  }, [item.id]);

  async function enviar() {
    if (!nome.trim() || !texto.trim()) { setErro("Preencha nome e comentário."); return; }
    setEnviando(true); setErro(""); setSucesso(false);
    try {
      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "addComentario", id: item.id, nome: nome.trim(), texto: texto.trim() }),
      });
      setSucesso(true); setNome(""); setTexto("");
      setComentarios((c) => [...(c ?? []), { nome: nome.trim(), texto: texto.trim() }]);
    } catch { setErro("Erro ao enviar."); }
    setEnviando(false);
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary">
        <ChevronLeft className="size-4" /> Fórum
      </button>
      <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
        <div className="size-12 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
          {item.capa ? <img src={driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" /> : <Music className="size-5 text-primary/30 m-auto" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black truncate uppercase">{item.titulo}</p>
          <p className="text-[10px] text-muted-foreground truncate">{item.artista} · {categoria}</p>
        </div>
      </div>
      <div className="space-y-2">
        {comentarios === null ? (
          <SkeletonList rows={3} />
        ) : comentarios.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6 opacity-40">Seja o primeiro a comentar.</p>
        ) : (
          comentarios.map((c, i) => (
            <div key={i} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[10px] font-black text-primary mb-1">{c.nome}</p>
              <p className="text-xs text-muted-foreground">{c.texto}</p>
            </div>
          ))
        )}
      </div>
      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-2.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40" />
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Seu comentário..." rows={3} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-2.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 resize-none" />
        {erro && <p className="text-[10px] text-red-400">{erro}</p>}
        {sucesso && <p className="text-[10px] text-green-400">Comentário enviado!</p>}
        <button onClick={enviar} disabled={enviando} className="w-full py-2.5 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
          <Send className="size-3" /> {enviando ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}

function ForumTab({ musicasDB, musicVideosDB, videosDB, loading }: {
  musicasDB: SheetItem[];
  musicVideosDB: SheetItem[];
  videosDB: SheetItem[];
  loading: boolean;
}) {
  const [openItem, setOpenItem] = useState<{ item: PlayItem; categoria: string } | null>(null);
  const [forumTab, setForumTab] = useState<"musicas" | "clipes" | "videos">("musicas");

  const musicas  = useMemo(() => musicasDB.map((m) => toPlayItem(m, "musica")), [musicasDB]);
  const clipes   = useMemo(() => musicVideosDB.map((m) => toPlayItem(m, "musicvideo")), [musicVideosDB]);
  const videos   = useMemo(() => videosDB.map((m) => toPlayItem(m, "video")), [videosDB]);

  const list = forumTab === "musicas" ? musicas : forumTab === "clipes" ? clipes : videos;
  const categoriaLabel = forumTab === "musicas" ? "Música" : forumTab === "clipes" ? "Clipe" : "Vídeo";

  if (openItem) return <ForumTopicoDetalhe item={openItem.item} categoria={openItem.categoria} onBack={() => setOpenItem(null)} />;

  if (loading) return <SkeletonList rows={6} />;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["musicas", "clipes", "videos"] as const).map((t) => (
          <button key={t} onClick={() => setForumTab(t)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              forumTab === t ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}>
            {t === "musicas" ? "Músicas" : t === "clipes" ? "Clipes" : "Vídeos"}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {list.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum item ainda.</p>
        ) : (
          list.map((item, i) => (
            <button key={item.id} onClick={() => setOpenItem({ item, categoria: categoriaLabel })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-transparent hover:bg-white/[0.04] text-left transition-all">
              <span className="text-[10px] font-black text-muted-foreground/50 w-5 text-center flex-shrink-0">{i + 1}</span>
              <div className="size-10 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
                {item.capa ? <img src={driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /> : <Music className="size-4 text-primary/30 m-auto" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black truncate uppercase tracking-tight">{item.titulo || "—"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
              </div>
              <MessageSquare className="size-4 text-muted-foreground/30 flex-shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── PlayHomePage ──────────────────────────────────────────────────────────
function PlayHomePage() {
  const [tab, setTab] = useState<Tab>("home");
  const [musicasDB,      setMusicasDB]      = useState<SheetItem[]>([]);
  const [musicVideosDB,  setMusicVideosDB]  = useState<SheetItem[]>([]);
  const [videosDB,       setVideosDB]       = useState<SheetItem[]>([]);
  const [charts,         setCharts]         = useState<ChartData[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [chartsLoading,  setChartsLoading]  = useState(true);
  const [chartsError,    setChartsError]    = useState("");
  const tabBarRef = useRef<HTMLDivElement>(null);

  // ── Fetch principal (músicas, clipes, vídeos via API GAS) ─────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${API_URL}?action=getPlay`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.musicas)     setMusicasDB(data.musicas);
        if (data?.musicVideos) setMusicVideosDB(data.musicVideos);
        if (data?.videos)      setVideosDB(data.videos);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ── Fetch charts (CSV do Google Sheets) ───────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setChartsLoading(true);
    setChartsError("");

    Promise.all(
      CHARTS_CONFIG.map(async (cfg) => {
        const { values, error } = await fetchSheetValues(cfg.aba);
        if (error) return { ...cfg, error };
        const { entries, capaDaPlaylist } = processChart(values, cfg.isVideo, cfg.maxEntries);
        return { ...cfg, entries, capaDaPlaylist };
      })
    ).then((results) => {
      if (cancelled) return;
      const errors: string[] = [];
      const loaded: ChartData[] = [];
      for (const r of results) {
        if ("error" in r && r.error) errors.push(`${r.nome}: ${r.error}`);
        else if ("entries" in r && r.entries.length > 0) loaded.push(r as ChartData);
      }
      setCharts(loaded);
      if (errors.length > 0) setChartsError(errors.join(" | "));
    }).finally(() => { if (!cancelled) setChartsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ── Scroll a tab ativa para o centro ──────────────────────────────────
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const active = bar.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (!active) return;
    const barRect  = bar.getBoundingClientRect();
    const btnRect  = active.getBoundingClientRect();
    const scrollTo = active.offsetLeft - barRect.width / 2 + btnRect.width / 2;
    bar.scrollTo({ left: scrollTo, behavior: "smooth" });
  }, [tab]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Tab bar */}
      <div
        ref={tabBarRef}
        className="sticky top-0 z-10 flex gap-1 p-1.5 bg-background/80 backdrop-blur-xl border-b border-white/[0.05] overflow-x-auto scrollbar-hide"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            data-tab={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex-shrink-0 transition-all ${
              tab === id
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="size-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 pb-32">
        {tab === "home" && (
          <HomeTab
            musicasDB={musicasDB}
            playMusicVideosDB={musicVideosDB}
            charts={charts}
            chartsLoading={chartsLoading}
            chartsError={chartsError}
            loading={loading}
            onTabChange={setTab}
          />
        )}
        {tab === "musicas" && <MusicasTab musicasDB={musicasDB} loading={loading} />}
        {tab === "clipes"  && <ClipesTab  musicVideosDB={musicVideosDB} loading={loading} />}
        {tab === "videos"  && <VideosTab  videosDB={videosDB} loading={loading} />}
        {tab === "forum"   && <ForumTab   musicasDB={musicasDB} musicVideosDB={musicVideosDB} videosDB={videosDB} loading={loading} />}
      </div>
    </div>
  );
}
