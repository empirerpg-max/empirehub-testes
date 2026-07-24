import { useState, useMemo } from "react";
import { Music2, Video, BarChart2, Play as PlayIcon, ChevronRight } from "lucide-react";
import { usePlay, type PlayItem, detectMediaType } from "../lib/playContext";

import musicasRaw from "../mocks/musicas.json";
import videosRaw from "../mocks/videos.json";
import chartsRaw from "../mocks/charts.json";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type RawMusica = {
  id: string;
  "Nome da música": string;
  "ACT Principal": string;
  "Capa da música": string;
  "ID do arquivo": string;
  "Letra"?: string;
};
type RawVideo = {
  id: string;
  "Tipo de Clipe": string;
  "ACT Principal": string;
  "Thumb": string;
  "ID do arquivo": string;
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

// ── Adaptadores ───────────────────────────────────────────────────────────────

const toMusica = (r: RawMusica): PlayItem => ({
  id: r.id,
  titulo: r["Nome da música"],
  artista: r["ACT Principal"],
  capa: r["Capa da música"],
  audioSrc: r["ID do arquivo"],
  letra: r["Letra"],
  categoria: "musica",
});
const toVideo = (r: RawVideo): PlayItem => ({
  id: r.id,
  titulo: r["Tipo de Clipe"],
  artista: r["ACT Principal"],
  capa: r["Thumb"],
  audioSrc: r["ID do arquivo"],
  categoria: "musicvideo",
});
const toChart = (r: RawChartItem, i: number): PlayItem => ({
  id: r["ID do tópico"] || `chart-${i}`,
  titulo: r["Nome da música"] ?? r["Nome do vídeo"] ?? "Sem título",
  artista: r["ID do criador"] ?? "",
  capa: r["Capa da música"] ?? r["Thumb"] ?? "",
  audioSrc: r["ID do arquivo"],
  categoria: "musica",
});

// ── Helpers visuais ───────────────────────────────────────────────────────────

function driveImg(capa: string, size = 120) {
  if (!capa) return "";
  const id =
    capa.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    capa.match(/id=([a-zA-Z0-9_-]+)/)?.[1] ||
    (!/^https?:\/\//.test(capa) && !capa.includes("/") ? capa : null);
  return id ? `https://lh3.googleusercontent.com/d/${id}=w${size}` : capa;
}

function Badge({ src }: { src: string }) {
  const t = detectMediaType(src);
  const map = {
    telegram: { bg: "rgba(59,130,246,0.2)", color: "#93c5fd", label: "TG" },
    youtube:  { bg: "rgba(239,68,68,0.2)",  color: "#fca5a5", label: "YT" },
    drive:    { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", label: "DR" },
  };
  const s = map[t];
  return (
    <span style={{
      fontSize: 8, fontFamily: "monospace", fontWeight: 700,
      background: s.bg, color: s.color,
      borderRadius: 4, padding: "1px 4px", textTransform: "uppercase",
      flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

const PauseIcon = () => (
  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);
const PlaySvg = () => (
  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

// ── Cards ─────────────────────────────────────────────────────────────────────

function MusicCard({ item, queue, isActive }: { item: PlayItem; queue: PlayItem[]; isActive: boolean }) {
  const { play, state } = usePlay();
  const playing = isActive && state.playing;
  return (
    <button
      onClick={() => play(item, queue, { autoPlay: true })}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", textAlign: "left",
        borderRadius: 12, padding: "10px 12px",
        background: isActive ? "rgba(255,255,255,0.07)" : "transparent",
        border: isActive ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
        cursor: "pointer", color: "#fff", transition: "background 0.15s",
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 8, overflow: "hidden",
        background: "rgba(255,255,255,0.05)", flexShrink: 0, position: "relative",
      }}>
        {item.capa
          ? <img src={driveImg(item.capa, 80)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
          : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
              <Music2 size={14} color="rgba(255,255,255,0.2)" />
            </div>}
        {isActive && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "grid", placeItems: "center", color: "#fff",
          }}>
            {playing ? <PauseIcon /> : <PlaySvg />}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          fontSize: 12, fontWeight: 700, margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: isActive ? "#fff" : "rgba(255,255,255,0.85)",
        }}>{item.titulo}</p>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "2px 0 0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.artista}
        </p>
      </div>
      <Badge src={item.audioSrc} />
    </button>
  );
}

function VideoCard({ item, isActive }: { item: PlayItem; isActive: boolean }) {
  const { play, state } = usePlay();
  const playing = isActive && state.playing;
  return (
    <button
      onClick={() => play(item, undefined, { autoPlay: true })}
      style={{
        position: "relative", flexShrink: 0, width: 144,
        borderRadius: 12, overflow: "hidden", aspectRatio: "16/9",
        background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer",
        outline: isActive ? "2px solid rgba(255,255,255,0.6)" : "none",
        transition: "transform 0.15s",
      }}
    >
      {item.capa
        ? <img src={driveImg(item.capa, 300)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
            <Video size={20} color="rgba(255,255,255,0.2)" />
          </div>}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)",
      }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 8 }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: "#fff", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.titulo}
        </p>
        <p style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>{item.artista}</p>
      </div>
      <div style={{ position: "absolute", top: 6, right: 6 }}>
        <Badge src={item.audioSrc} />
      </div>
      {isActive && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "grid", placeItems: "center",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(255,255,255,0.9)", display: "grid", placeItems: "center",
          }}>
            {playing ? <PauseIcon /> : <PlaySvg />}
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
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", textAlign: "left", color: "#fff",
        borderRadius: 8, padding: "8px 10px",
        background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
        border: "1px solid transparent", cursor: "pointer", transition: "background 0.15s",
      }}
    >
      <span style={{
        fontSize: 11, fontWeight: 900, width: 16,
        color: isActive ? "#fff" : "rgba(255,255,255,0.25)",
        fontVariantNumeric: "tabular-nums", flexShrink: 0,
      }}>{position}</span>
      <div style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden",
        background: "rgba(255,255,255,0.05)", flexShrink: 0 }}>
        {item.capa
          ? <img src={driveImg(item.capa, 64)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
          : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
              <Music2 size={11} color="rgba(255,255,255,0.2)" />
            </div>}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 11, fontWeight: 700, margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: isActive ? "#fff" : "rgba(255,255,255,0.85)" }}>
          {item.titulo}
        </p>
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", margin: "1px 0 0" }}>{item.artista}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <Badge src={item.audioSrc} />
        {isActive && playing
          ? <PauseIcon />
          : <ChevronRight size={11} color="rgba(255,255,255,0.2)" />}
      </div>
    </button>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type TabId = "musicas" | "videos" | "charts";
type ChartTab = "spotify" | "apple" | "youtube";

const TABS: { id: TabId; label: string; Icon: typeof Music2 }[] = [
  { id: "musicas", label: "Músicas", Icon: Music2 },
  { id: "videos",  label: "Vídeos",  Icon: Video },
  { id: "charts",  label: "Charts",  Icon: BarChart2 },
];
const CHART_TABS: { id: ChartTab; label: string }[] = [
  { id: "spotify", label: "Spotify" },
  { id: "apple",   label: "Apple" },
  { id: "youtube", label: "YouTube" },
];

export function EmpirePlay() {
  const { state } = usePlay();
  const [tab, setTab] = useState<TabId>("musicas");
  const [chartTab, setChartTab] = useState<ChartTab>("spotify");

  const musicas = useMemo(() => (musicasRaw as RawMusica[]).map(toMusica), []);
  const videos  = useMemo(() => (videosRaw  as RawVideo[]).map(toVideo),  []);
  const charts  = useMemo(() => ({
    spotify: (chartsRaw.spotify as RawChartItem[]).map(toChart),
    apple:   (chartsRaw.apple   as RawChartItem[]).map(toChart),
    youtube: (chartsRaw.youtube as RawChartItem[]).map(toChart),
  }), []);

  const activeId = state.currentIdx !== null ? state.queue[state.currentIdx]?.id : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 16px",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 0" }}>
            <PlayIcon size={14} color="rgba(255,255,255,0.6)" />
            <span style={{
              fontSize: 11, fontWeight: 900, textTransform: "uppercase",
              letterSpacing: "0.18em", color: "rgba(255,255,255,0.9)",
            }}>Empire Play</span>
            <span style={{
              marginLeft: "auto", fontSize: 8,
              color: "rgba(255,255,255,0.2)", fontFamily: "monospace",
            }}>v-testes</span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 12px",
                  fontSize: 11, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: `2px solid ${tab === id ? "#fff" : "transparent"}`,
                  color: tab === id ? "#fff" : "rgba(255,255,255,0.35)",
                  transition: "color 0.15s",
                  marginBottom: -1,
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 640, margin: "0 auto", width: "100%", padding: "16px 16px 0" }}>

        {tab === "musicas" && (
          <section>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.14em", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
              {musicas.length} faixas
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {musicas.map((item) => (
                <MusicCard key={item.id} item={item} queue={musicas} isActive={activeId === item.id} />
              ))}
            </div>
          </section>
        )}

        {tab === "videos" && (
          <section>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.14em", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
              {videos.length} clipes
            </p>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
              {videos.map((item) => (
                <VideoCard key={item.id} item={item} isActive={activeId === item.id} />
              ))}
            </div>
          </section>
        )}

        {tab === "charts" && (
          <section>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {CHART_TABS.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setChartTab(ct.id)}
                  style={{
                    padding: "5px 14px", borderRadius: 999,
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    background: chartTab === ct.id ? "#fff" : "rgba(255,255,255,0.06)",
                    color: chartTab === ct.id ? "#000" : "rgba(255,255,255,0.4)",
                    border: "none", cursor: "pointer", transition: "background 0.15s",
                  }}
                >
                  {ct.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {charts[chartTab].map((item, idx) => (
                <ChartRow key={item.id} item={item} position={idx + 1} isActive={activeId === item.id} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default EmpirePlay;
