import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Music2, Video, BarChart2, Play as PlayIcon, ChevronRight } from "lucide-react";
import { usePlay, type PlayItem, detectMediaType } from "@/lib/playContext";

import musicasRaw from "@/mocks/musicas.json";
import videosRaw from "@/mocks/videos.json";
import chartsRaw from "@/mocks/charts.json";

export const Route = createFileRoute("/play/")({ component: EmpirePlay });

// ─────────────────────────────────────────────────────────────────────────────
// Adaptadores mock → PlayItem
// ─────────────────────────────────────────────────────────────────────────────

type RawMusica = {
  id: string;
  "Nome da música": string;
  "ACT Principal": string;
  "Capa da música": string;
  "ID do arquivo": string;
  "Letra"?: string;
  "Data de lançamento"?: string;
  "ID do tópico"?: string;
};

type RawVideo = {
  id: string;
  "Tipo de Clipe": string;
  "ACT Principal": string;
  "Thumb": string;
  "ID do arquivo": string;
  "Data de lançamento"?: string;
  "ID do tópico"?: string;
};

type RawChartItem = {
  "Posição": string;
  "Nome da música"?: string;
  "Nome do vídeo"?: string;
  "Capa da música"?: string;
  "Thumb"?: string;
  "ID do tópico": string;
  "ID do arquivo": string;
  "ID do criador"?: string;
};

function rawMusicaToPlayItem(r: RawMusica): PlayItem {
  return {
    id: r.id,
    titulo: r["Nome da música"],
    artista: r["ACT Principal"],
    capa: r["Capa da música"],
    audioSrc: r["ID do arquivo"],
    letra: r["Letra"],
    categoria: "musica",
  };
}

function rawVideoToPlayItem(r: RawVideo): PlayItem {
  return {
    id: r.id,
    titulo: r["Tipo de Clipe"],
    artista: r["ACT Principal"],
    capa: r["Thumb"],
    audioSrc: r["ID do arquivo"],
    categoria: "musicvideo",
  };
}

function rawChartToPlayItem(r: RawChartItem, idx: number): PlayItem {
  return {
    id: r["ID do tópico"] || `chart-${idx}`,
    titulo: r["Nome da música"] ?? r["Nome do vídeo"] ?? "Sem título",
    artista: r["ID do criador"] ?? "",
    capa: r["Capa da música"] ?? r["Thumb"] ?? "",
    audioSrc: r["ID do arquivo"],
    categoria: "musica",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers visuais
// ─────────────────────────────────────────────────────────────────────────────

function driveImg(capa: string, size = 120): string {
  if (!capa) return "";
  const id =
    capa.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    capa.match(/id=([a-zA-Z0-9_-]+)/)?.[1] ||
    (!/^https?:\/\//.test(capa) && !capa.includes("/") ? capa : null);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`;
  return capa;
}

function mediaTypeBadge(audioSrc: string) {
  const t = detectMediaType(audioSrc);
  if (t === "telegram") return <span className="text-[8px] font-mono bg-blue-500/20 text-blue-400 rounded px-1 py-0.5 uppercase">TG</span>;
  if (t === "youtube")  return <span className="text-[8px] font-mono bg-red-500/20 text-red-400 rounded px-1 py-0.5 uppercase">YT</span>;
  return <span className="text-[8px] font-mono bg-white/10 text-white/40 rounded px-1 py-0.5 uppercase">DR</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <h2 className="text-xs font-black uppercase tracking-widest text-white/60">{label}</h2>
    </div>
  );
}

function MusicCard({ item, queue, isActive }: { item: PlayItem; queue: PlayItem[]; isActive: boolean }) {
  const { play, state } = usePlay();
  const playing = isActive && state.playing;

  return (
    <button
      onClick={() => play(item, queue, { autoPlay: true })}
      className={`flex items-center gap-3 w-full text-left rounded-xl px-3 py-2.5 transition-all ${
        isActive
          ? "bg-primary/10 ring-1 ring-primary/40"
          : "hover:bg-white/5 active:bg-white/10"
      }`}
    >
      {/* Capa */}
      <div className="size-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 relative">
        {item.capa ? (
          <img src={driveImg(item.capa, 80)} alt={item.titulo}
            className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Music2 className="size-4 text-white/30" />
          </div>
        )}
        {isActive && (
          <div className="absolute inset-0 bg-primary/30 grid place-items-center">
            {playing ? (
              <svg className="size-3 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="size-3 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold truncate ${ isActive ? "text-primary" : "text-white" }`}>
          {item.titulo}
        </p>
        <p className="text-[11px] text-white/40 truncate">{item.artista}</p>
      </div>

      {/* Badge */}
      <div className="flex-shrink-0">
        {mediaTypeBadge(item.audioSrc)}
      </div>
    </button>
  );
}

function VideoCard({ item, isActive }: { item: PlayItem; isActive: boolean }) {
  const { play, state } = usePlay();
  const playing = isActive && state.playing;

  return (
    <button
      onClick={() => play(item, undefined, { autoPlay: true })}
      className={`relative flex-shrink-0 w-36 rounded-xl overflow-hidden aspect-video bg-white/5 transition-all ${
        isActive ? "ring-2 ring-primary" : "hover:scale-105"
      }`}
    >
      {item.capa ? (
        <img src={driveImg(item.capa, 300)} alt={item.titulo}
          className="w-full h-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="w-full h-full grid place-items-center bg-white/5">
          <Video className="size-6 text-white/20" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-[10px] font-bold text-white truncate">{item.titulo}</p>
        <p className="text-[9px] text-white/50 truncate">{item.artista}</p>
      </div>
      <div className="absolute top-1.5 right-1.5">
        {mediaTypeBadge(item.audioSrc)}
      </div>
      {isActive && (
        <div className="absolute inset-0 bg-primary/20 grid place-items-center">
          <div className="size-8 rounded-full bg-primary/80 grid place-items-center">
            {playing ? (
              <svg className="size-3 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="size-3 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

function ChartRow({ item, position, isActive }: { item: PlayItem; position: number; isActive: boolean }) {
  const { play, state } = usePlay();
  const playing = isActive && state.playing;

  return (
    <button
      onClick={() => play(item, undefined, { autoPlay: true })}
      className={`flex items-center gap-3 w-full text-left rounded-lg px-3 py-2 transition-all ${
        isActive ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-white/5"
      }`}
    >
      <span className={`text-xs font-black w-4 tabular-nums ${ isActive ? "text-primary" : "text-white/30" }`}>
        {position}
      </span>
      <div className="size-8 rounded-md overflow-hidden bg-white/5 flex-shrink-0">
        {item.capa ? (
          <img src={driveImg(item.capa, 64)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Music2 className="size-3 text-white/20" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold truncate ${ isActive ? "text-primary" : "text-white" }`}>
          {item.titulo}
        </p>
        <p className="text-[10px] text-white/40 truncate">{item.artista}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {mediaTypeBadge(item.audioSrc)}
        {isActive && playing ? (
          <svg className="size-3 fill-primary" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <ChevronRight className="size-3 text-white/20" />
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "musicas", label: "Músicas", icon: <Music2 className="size-3.5" /> },
  { id: "videos", label: "Vídeos", icon: <Video className="size-3.5" /> },
  { id: "charts", label: "Charts", icon: <BarChart2 className="size-3.5" /> },
] as const;

type TabId = typeof TABS[number]["id"];

const CHART_TABS = [
  { id: "spotify", label: "Spotify" },
  { id: "apple", label: "Apple" },
  { id: "youtube", label: "YouTube" },
] as const;

type ChartTab = typeof CHART_TABS[number]["id"];

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

function EmpirePlay() {
  const { state } = usePlay();
  const [tab, setTab] = useState<TabId>("musicas");
  const [chartTab, setChartTab] = useState<ChartTab>("spotify");

  const musicas = useMemo(() => (musicasRaw as RawMusica[]).map(rawMusicaToPlayItem), []);
  const videos  = useMemo(() => (videosRaw as RawVideo[]).map(rawVideoToPlayItem), []);
  const charts  = useMemo(() => ({
    spotify: (chartsRaw.spotify as RawChartItem[]).map(rawChartToPlayItem),
    apple:   (chartsRaw.apple   as RawChartItem[]).map(rawChartToPlayItem),
    youtube: (chartsRaw.youtube as RawChartItem[]).map(rawChartToPlayItem),
  }), []);

  const activeId =
    state.currentIdx !== null ? state.queue[state.currentIdx]?.id : null;

  return (
    <div className="flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-white/5 px-4 pt-2 pb-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 pb-2">
            <PlayIcon className="size-4 text-primary" />
            <span className="text-sm font-black uppercase tracking-widest">Empire Play</span>
            <span className="ml-auto text-[9px] text-white/20 font-mono uppercase">v-testes</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-white/40 hover:text-white/70"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="max-w-2xl mx-auto w-full px-4 py-4 space-y-2">

        {/* ─── Tab Músicas ─── */}
        {tab === "musicas" && (
          <section>
            <SectionHeader
              icon={<Music2 className="size-4" />}
              label={`${musicas.length} faixas`}
            />
            <div className="space-y-0.5">
              {musicas.map((item) => (
                <MusicCard
                  key={item.id}
                  item={item}
                  queue={musicas}
                  isActive={activeId === item.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* ─── Tab Vídeos ─── */}
        {tab === "videos" && (
          <section>
            <SectionHeader
              icon={<Video className="size-4" />}
              label={`${videos.length} clipes`}
            />
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {videos.map((item) => (
                <VideoCard
                  key={item.id}
                  item={item}
                  isActive={activeId === item.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* ─── Tab Charts ─── */}
        {tab === "charts" && (
          <section>
            {/* Sub-tabs das plataformas */}
            <div className="flex gap-1 mb-4">
              {CHART_TABS.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setChartTab(ct.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide transition-colors ${
                    chartTab === ct.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-white/40 hover:text-white/70"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>

            <SectionHeader
              icon={<BarChart2 className="size-4" />}
              label={`Top ${charts[chartTab].length} — ${CHART_TABS.find(c => c.id === chartTab)?.label}`}
            />

            <div className="space-y-0.5">
              {charts[chartTab].map((item, idx) => (
                <ChartRow
                  key={item.id}
                  item={item}
                  position={idx + 1}
                  isActive={activeId === item.id}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
