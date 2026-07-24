/**
 * MiniPlayer — player de áudio/vídeo background.
 *
 * Suporta três tipos de mídia (MediaType):
 *
 * ─ "drive"    → <audio> nativo via proxy Cloudflare Worker
 * ─ "youtube"  → YT.Player injetado em div invisível (1×1 px)
 * ─ "telegram" → <audio> nativo via API intermediária (telegramStreamUrl)
 *                Mesmo fluxo do Drive, apenas URL diferente.
 *                Para arquivos > 20 MB: usar Local Bot API Server (--local).
 *
 * Fluxo com autoPlay=true:
 *   1. onClick → play(item, queue, { autoPlay: true })
 *   2. playContext seta playing:true imediatamente
 *   3. useEffect [currentMediaId] → configura src (sem play)
 *   4. useEffect [currentMediaId, playing] → playing:true → triggerPlay()
 */

import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  usePlay,
  driveStreamUrl,
  detectMediaType,
  extractYouTubeId,
  extractDriveId,
  extractTelegramFileId,
} from '@/lib/playContext';
import { telegramStreamUrl } from '@/lib/telegramStorage';
import { ChevronLeft, ChevronRight, X, Music } from 'lucide-react';

// ─── Thumb helper (Drive) ────────────────────────────────────────────────────
function driveThumb(capa: string, size = 80): string {
  if (!capa) return '';
  const m = capa.match(/\/d\/([a-zA-Z0-9_-]+)/) || capa.match(/id=([a-zA-Z0-9_-]+)/);
  const id = m ? m[1] : (!/^https?:\/\//.test(capa) && !capa.includes('/') ? capa : null);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`;
  return capa;
}

// ─── YT API type shim ─────────────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YT.Player;
      PlayerState: { UNSTARTED: -1; ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

// ─── Hook: carrega a YT IFrame API uma única vez ──────────────────────────────
function useLoadYTApi(onReady: () => void) {
  const cbRef = useRef(onReady);
  cbRef.current = onReady;

  useEffect(() => {
    if (window.YT?.Player) { cbRef.current(); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); cbRef.current(); };
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);
}

// ─── MiniPlayer ───────────────────────────────────────────────────────────────
export function MiniPlayer() {
  const {
    state, pause, resume, next, prev, close,
    mediaType, currentMediaId,
    audioRef, ytPlayerRef,
    confirmPlaying, confirmPaused, onEnded,
  } = usePlay();

  const { queue, currentIdx, playing } = state;

  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytApiReady = useRef(false);
  const ytActiveId = useRef<string | null>(null);
  const pendingPlay = useRef(false);

  // ── 1. Cria o <audio> nativo (uma única vez) ─────────────────────────────
  useEffect(() => {
    if (audioRef.current) return;
    const audio = new Audio();
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
    audio.addEventListener('play', confirmPlaying);
    audio.addEventListener('pause', confirmPaused);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', (e) => {
      console.error('[MiniPlayer] Erro de áudio:', (e.target as HTMLAudioElement).error);
      confirmPaused();
      toast.error('Não foi possível carregar a mídia.');
    });
    audioRef.current = audio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Cria / recria o YT.Player ─────────────────────────────────────────
  const buildYTPlayer = useCallback(
    (videoId: string, autoStart: boolean) => {
      if (!ytContainerRef.current) return;
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch { /* */ }
        ytPlayerRef.current = null;
      }
      ytActiveId.current = videoId;
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId,
        width: '1', height: '1',
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady(e: YT.PlayerEvent) {
            if (autoStart || pendingPlay.current) { pendingPlay.current = false; e.target.playVideo(); }
          },
          onStateChange(e: YT.OnStateChangeEvent) {
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) confirmPlaying();
            if (e.data === S.PAUSED) confirmPaused();
            if (e.data === S.ENDED) onEnded();
          },
          onError() { confirmPaused(); toast.error('Erro ao carregar vídeo do YouTube.'); },
        },
      });
    },
    [ytPlayerRef, confirmPlaying, confirmPaused, onEnded]
  );

  const onYTApiReady = useCallback(() => {
    ytApiReady.current = true;
    if (mediaType === 'youtube' && currentMediaId && ytActiveId.current !== currentMediaId) {
      buildYTPlayer(currentMediaId, pendingPlay.current);
    }
  }, [mediaType, currentMediaId, buildYTPlayer]);

  useLoadYTApi(onYTApiReady);

  // ── 3. Reage à troca de faixa — configura src, NÃO inicia reprodução ─────
  useEffect(() => {
    if (!currentMediaId) return;

    // Drive: proxy Cloudflare Worker (original)
    if (mediaType === 'drive') {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.src = driveStreamUrl(currentMediaId);
      audio.load();
    }

    // Telegram: API intermediária local (mesmo fluxo do Drive)
    if (mediaType === 'telegram') {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.src = telegramStreamUrl(currentMediaId);
      audio.load();
    }

    // YouTube: cria/recria o YT.Player
    if (mediaType === 'youtube') {
      if (!ytApiReady.current) return;
      if (ytActiveId.current !== currentMediaId) {
        buildYTPlayer(currentMediaId, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, mediaType]);

  // ── 4. Auto-play quando playing === true ─────────────────────────────────
  useEffect(() => {
    if (!currentMediaId || !playing) return;
    const id = setTimeout(() => {

      // Drive e Telegram: mesmo <audio> nativo
      if (mediaType === 'drive' || mediaType === 'telegram') {
        const audio = audioRef.current;
        if (!audio) return;
        audio.play().catch(() => {
          confirmPaused();
          toast.error('Falha ao reproduzir. Verifique se o arquivo está acessível.');
        });
      }

      // YouTube: YT.Player
      if (mediaType === 'youtube') {
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

  // ── 5. Limpa ao desmontar ────────────────────────────────────────────────
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 6. triggerPlay — com user-gesture garantido ──────────────────────────
  const triggerPlay = useCallback(() => {
    if (mediaType === 'drive' || mediaType === 'telegram') {
      const audio = audioRef.current;
      if (!audio) return;
      audio.play().catch(() => {
        confirmPaused();
        toast.error('Falha ao reproduzir.');
      });
      return;
    }
    if (mediaType === 'youtube') {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.playVideo(); } catch { pendingPlay.current = true; }
      } else {
        pendingPlay.current = true;
        if (ytApiReady.current && currentMediaId) buildYTPlayer(currentMediaId, true);
      }
    }
  }, [mediaType, audioRef, ytPlayerRef, currentMediaId, buildYTPlayer, confirmPaused]);

  // ── 7. triggerPause ──────────────────────────────────────────────────────
  const triggerPause = useCallback(() => {