import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  usePlay,
  driveStreamUrl,
  telegramStreamUrl,
  extractYouTubeId,
  extractDriveId,
  extractTelegramFileId,
} from "../lib/playContext";
import { ChevronLeft, ChevronRight, X, Music2 } from "lucide-react";

function driveImg(capa: string, size = 80) {
  if (!capa) return "";
  const id =
    capa.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    capa.match(/id=([a-zA-Z0-9_-]+)/)?.[1] ||
    (!/^https?:\/\//.test(capa) && !capa.includes("/") ? capa : null);
  return id ? `https://lh3.googleusercontent.com/d/${id}=w${size}` : capa;
}

declare global {
  interface Window {
    YT: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YT.Player;
           PlayerState: { PLAYING: 1; PAUSED: 2; ENDED: 0 } };
    onYouTubeIframeAPIReady: () => void;
  }
}

function useLoadYTApi(onReady: () => void) {
  const cbRef = useRef(onReady);
  cbRef.current = onReady;
  useEffect(() => {
    if ((window as { YT?: unknown }).YT) { cbRef.current(); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); cbRef.current(); };
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  }, []);
}

export function MiniPlayer() {
  const { state, pause, resume, next, prev, close,
    mediaType, currentMediaId,
    audioRef, ytPlayerRef,
    confirmPlaying, confirmPaused, onEnded } = usePlay();

  const { queue, currentIdx, playing } = state;
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytApiReady = useRef(false);
  const ytActiveId = useRef<string | null>(null);
  const pendingPlay = useRef(false);

  const buildYTPlayer = useCallback((videoId: string, autoStart: boolean) => {
    if (!ytContainerRef.current) return;
    try { ytPlayerRef.current?.destroy(); } catch { /* */ }
    ytPlayerRef.current = null;
    ytActiveId.current = videoId;
    ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
      videoId, width: "1", height: "1",
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0, playsinline: 1 },
      events: {
        onReady(e: YT.PlayerEvent) {
          if (autoStart || pendingPlay.current) { pendingPlay.current = false; e.target.playVideo(); }
        },
        onStateChange(e: YT.OnStateChangeEvent) {
          if (e.data === 1) confirmPlaying();
          if (e.data === 2) confirmPaused();
          if (e.data === 0) onEnded();
        },
        onError() { confirmPaused(); toast.error("Erro ao carregar vídeo do YouTube."); },
      },
    });
  }, [ytPlayerRef, confirmPlaying, confirmPaused, onEnded]);

  useLoadYTApi(useCallback(() => {
    ytApiReady.current = true;
    if (mediaType === "youtube" && currentMediaId && ytActiveId.current !== currentMediaId)
      buildYTPlayer(currentMediaId, pendingPlay.current);
  }, [mediaType, currentMediaId, buildYTPlayer]));

  // Cria o <audio>
  useEffect(() => {
    if (audioRef.current) return;
    const audio = new Audio();
    audio.preload = "none";
    audio.addEventListener("play",  confirmPlaying);
    audio.addEventListener("pause", confirmPaused);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", () => {
      confirmPaused();
      toast.error("Não foi possível carregar a mídia.");
    });
    audioRef.current = audio;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de faixa
  useEffect(() => {
    if (!currentMediaId) return;
    const item = currentIdx !== null ? queue[currentIdx] : null;
    if (!item) return;
    if (mediaType === "drive" || mediaType === "telegram") {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.src = mediaType === "telegram"
        ? telegramStreamUrl(extractTelegramFileId(item.audioSrc) ?? item.audioSrc)
        : driveStreamUrl(extractDriveId(item.audioSrc) ?? item.audioSrc);
      audio.load();
    }
    if (mediaType === "youtube" && ytApiReady.current && ytActiveId.current !== currentMediaId)
      buildYTPlayer(currentMediaId, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, mediaType]);

  // Autoplay
  useEffect(() => {
    if (!currentMediaId || !playing) return;
    const id = setTimeout(() => {
      if (mediaType === "drive" || mediaType === "telegram") {
        audioRef.current?.play().catch(() => {
          confirmPaused();
          toast.error("Falha ao reproduzir. Verifique se o arquivo está acessível.");
        });
      }
      if (mediaType === "youtube") {
        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.playVideo(); } catch { pendingPlay.current = true; }
        } else {
          pendingPlay.current = true;
          if (ytApiReady.current && currentMediaId) buildYTPlayer(currentMediaId, true);
        }
      }
    }, 50);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, playing]);

  useEffect(() => () => { audioRef.current?.pause(); }, [audioRef]);

  if (currentIdx === null || queue.length === 0) return null;

  const item = queue[currentIdx];

  const handlePlayPause = () => {
    if (playing) {
      audioRef.current?.pause();
      try { ytPlayerRef.current?.pauseVideo(); } catch { /* */ }
      pause();
    } else {
      resume();
      if (mediaType === "drive" || mediaType === "telegram") {
        audioRef.current?.play().catch(() => { confirmPaused(); });
      } else if (mediaType === "youtube") {
        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.playVideo(); } catch { pendingPlay.current = true; }
        } else if (ytApiReady.current && currentMediaId) {
          buildYTPlayer(currentMediaId, true);
        }
      }
    }
  };

  return (
    <div style={{
      position: "fixed", bottom: 80, left: 0, right: 0, zIndex: 40,
      background: "rgba(20,20,20,0.96)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(20px)",
    }}>
      {mediaType === "youtube" && (
        <div style={{ position: "absolute", opacity: 0, pointerEvents: "none",
          width: 1, height: 1, overflow: "hidden", top: 0, left: 0 }} aria-hidden>
          <div ref={ytContainerRef} />
        </div>
      )}
      <div style={{
        maxWidth: 640, margin: "0 auto",
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        {/* Capa */}
        <div style={{
          width: 38, height: 38, borderRadius: 8, overflow: "hidden",
          background: "rgba(255,255,255,0.06)", flexShrink: 0,
        }}>
          {item.capa
            ? <img src={driveImg(item.capa, 80)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
            : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
                <Music2 size={14} color="rgba(255,255,255,0.3)" />
              </div>}
        </div>
        {/* Info */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, margin: 0, color: "#fff",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.titulo}
          </p>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>
            {item.artista}
          </p>
        </div>
        {/* Controles */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button onClick={() => prev()} disabled={currentIdx <= 0}
            style={{ width: 30, height: 30, display: "grid", placeItems: "center",
              background: "none", border: "none", cursor: "pointer",
              color: currentIdx <= 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)" }}
            aria-label="Anterior">
            <ChevronLeft size={16} />
          </button>
          <button onClick={handlePlayPause}
            style={{ width: 36, height: 36, borderRadius: "50%",
              background: "#fff", border: "none", cursor: "pointer",
              display: "grid", placeItems: "center" }}
            aria-label={playing ? "Pausar" : "Reproduzir"}>
            {playing
              ? <svg width="12" height="12" fill="#000" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              : <svg width="12" height="12" fill="#000" viewBox="0 0 24 24">
                  <polygon points="6,3 20,12 6,21" />
                </svg>}
          </button>
          <button onClick={() => next()} disabled={currentIdx >= queue.length - 1}
            style={{ width: 30, height: 30, display: "grid", placeItems: "center",
              background: "none", border: "none", cursor: "pointer",
              color: currentIdx >= queue.length - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)" }}
            aria-label="Próxima">
            <ChevronRight size={16} />
          </button>
          <button onClick={close}
            style={{ width: 28, height: 28, display: "grid", placeItems: "center",
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.35)", marginLeft: 2 }}
            aria-label="Fechar">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
