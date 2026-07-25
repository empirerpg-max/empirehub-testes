// ============================================================
// VideoPlayer — Player de vídeo moderno
// Suporta: YouTube (iframe), Drive (iframe /preview), Telegram (video nativo)
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import type { VideoItem } from '../../types';
import { getTelegramFileUrl } from '../../services/telegramBot';
import { driveToEmbedUrl, isDriveUrl } from '../../services/googleDrive';
import { parseYoutubeUrl, isYoutubeUrl } from '../../services/youtubeEmbed';

type PlayerMode = 'native' | 'iframe';

interface VideoPlayerProps {
  video: VideoItem;
  autoPlay?: boolean;
  onClose?: () => void;
  className?: string;
}

const PlayIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>;
const PauseIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>;
const FullscreenIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>;
const ExitFsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" /></svg>;
const VolumeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>;
const MuteIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>;
const CloseIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;

function formatTime(s: number): string {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ video, autoPlay = false, onClose, className = '' }: VideoPlayerProps) {
  const [mode, setMode] = useState<PlayerMode>('native');
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Resolve URL conforme a fonte ────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setResolvedUrl('');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowControls(true);

    async function resolve() {
      try {
        const url = video.videoUrl ?? '';

        if (video.source === 'youtube' || isYoutubeUrl(url)) {
          const parsed = parseYoutubeUrl(url);
          if (!parsed) throw new Error('URL do YouTube inválida');
          setResolvedUrl(parsed.embedUrl + (autoPlay ? '&autoplay=1' : ''));
          setMode('iframe');

        } else if (video.source === 'drive' || isDriveUrl(url)) {
          const embed = driveToEmbedUrl(url);
          if (!embed) throw new Error('URL do Drive inválida');
          setResolvedUrl(embed);
          setMode('iframe');

        } else if (video.source === 'telegram') {
          if (!video.telegramFileId) {
            throw new Error(
              'Este vídeo ainda não tem o file_id do Telegram preenchido.\n' +
              'Execute o workflow "Sync Telegram Videos" no GitHub Actions para gerar automaticamente.'
            );
          }
          const { file_url } = await getTelegramFileUrl(video.telegramFileId);
          setResolvedUrl(file_url);
          setMode('native');

        } else if (url) {
          setResolvedUrl(url);
          setMode('native');

        } else {
          throw new Error('Nenhuma URL de vídeo disponível para este item.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar vídeo');
      } finally {
        setIsLoading(false);
      }
    }

    resolve();
  }, [video, autoPlay]);

  // ─── Eventos do <video> nativo ───────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || mode !== 'native' || !resolvedUrl) return;

    const onPlay         = () => { setIsPlaying(true); };
    const onPause        = () => { setIsPlaying(false); setShowControls(true); };
    const onTimeUpdate   = () => setCurrentTime(v.currentTime);
    const onDuration     = () => setDuration(v.duration);
    const onWaiting      = () => setIsLoading(true);
    const onCanPlay      = () => { setIsLoading(false); };
    const onError        = () => setError('Erro ao reproduzir o vídeo. Tente novamente.');
    const onVolumeChange = () => { setVolume(v.volume); setIsMuted(v.muted); };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('durationchange', onDuration);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('error', onError);
    v.addEventListener('volumechange', onVolumeChange);

    // define volume inicial
    v.volume = volume;

    if (autoPlay) v.play().catch(() => {});

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('durationchange', onDuration);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('error', onError);
      v.removeEventListener('volumechange', onVolumeChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resolvedUrl, autoPlay]);

  // ─── Auto-ocultar controles (só quando tocando) ──────────────────────────
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setShowControls((prev) => {
        // só oculta se estiver tocando
        if (videoRef.current && !videoRef.current.paused) return false;
        return prev;
      });
    }, 3000);
  }, []);

  // controles sempre visíveis quando pausado
  useEffect(() => {
    if (!isPlaying) setShowControls(true);
  }, [isPlaying]);

  // ─── Fullscreen ──────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }

  function handleSeek(e: React.PointerEvent<HTMLDivElement>) {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(duration, ratio * duration));
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  }

  function handleVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.volume = v;
    setVolume(v);
    if (videoRef.current) videoRef.current.muted = false;
    setIsMuted(false);
  }

  function handleMute() {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  // controles visíveis: sempre quando pausado, ou quando showControls=true durante reprodução
  const controlsVisible = showControls || !isPlaying;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl bg-black ${className}`}
      style={{ aspectRatio: '16/9' }}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* Botão fechar */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-30 p-2 rounded-full transition-all"
          style={{ background: 'oklch(0 0 0 / 60%)', color: 'white' }}
        >
          <CloseIcon />
        </button>
      )}

      {/* Loading */}
      {isLoading && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
          style={{ background: 'oklch(0.05 0 0 / 90%)' }}
        >
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--primary, #4f98a3)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'oklch(0.7 0 0)' }}>Carregando vídeo…</p>
        </div>
      )}

      {/* Erro */}
      {error && !isLoading && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center"
          style={{ background: 'oklch(0.08 0 0)' }}
        >
          <span style={{ fontSize: '2.5rem' }}>⚠️</span>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'white' }}>Não foi possível reproduzir</p>
            {error.split('\n').map((line, i) => (
              <p key={i} className="text-xs" style={{ color: 'oklch(0.6 0 0)' }}>{line}</p>
            ))}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--primary, #4f98a3)', color: 'white' }}
            >
              Fechar
            </button>
          )}
        </div>
      )}

      {/* Player iframe (YouTube / Drive) */}
      {!error && !isLoading && mode === 'iframe' && resolvedUrl && (
        <iframe
          src={resolvedUrl}
          title={video.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
          style={{ border: 'none' }}
          onLoad={() => setIsLoading(false)}
        />
      )}

      {/* Player nativo (Telegram / URL direta) */}
      {!error && mode === 'native' && resolvedUrl && (
        <>
          <video
            ref={videoRef}
            src={resolvedUrl}
            className="absolute inset-0 w-full h-full object-contain"
            playsInline
            preload="metadata"
            onClick={togglePlay}
            style={{ cursor: 'pointer' }}
          />

          {/* Overlay de controles — sempre visível quando pausado */}
          <div
            className="absolute inset-0 z-10 flex flex-col justify-end"
            style={{
              opacity: controlsVisible ? 1 : 0,
              transition: 'opacity 0.25s ease',
              pointerEvents: controlsVisible ? 'auto' : 'none',
              background: 'linear-gradient(to top, oklch(0 0 0 / 85%) 0%, oklch(0 0 0 / 20%) 45%, transparent 100%)',
            }}
          >
            {/* Botão play central */}
            {!isPlaying && !isLoading && (
              <button
                onClick={togglePlay}
                aria-label="Reproduzir"
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'transparent' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: 'oklch(0 0 0 / 65%)',
                    border: '2px solid var(--primary, #4f98a3)',
                    color: 'var(--primary, #4f98a3)',
                    boxShadow: '0 0 24px var(--primary, #4f98a3)',
                  }}
                >
                  <PlayIcon />
                </div>
              </button>
            )}

            {/* Controles inferiores */}
            <div className="px-4 pb-4 flex flex-col gap-2">
              {/* Título + Fullscreen */}
              <div className="flex items-end justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: 'white' }}>{video.title}</p>
                  <p className="text-xs" style={{ color: 'oklch(1 0 0 / 65%)' }}>{video.artist}</p>
                </div>
                <button
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Sair do fullscreen' : 'Tela cheia'}
                  className="ml-3 p-2 rounded-lg flex-shrink-0"
                  style={{ color: 'white', background: 'oklch(1 0 0 / 10%)' }}
                >
                  {isFullscreen ? <ExitFsIcon /> : <FullscreenIcon />}
                </button>
              </div>

              {/* Barra de progresso */}
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums" style={{ color: 'white', minWidth: '2.8rem', textAlign: 'right' }}>
                  {formatTime(currentTime)}
                </span>
                <div
                  className="relative flex-1 rounded-full cursor-pointer group"
                  style={{ height: 4, background: 'oklch(1 0 0 / 25%)' }}
                  onPointerDown={handleSeek}
                  role="slider"
                  aria-label="Progresso"
                  aria-valuemin={0}
                  aria-valuemax={duration}
                  aria-valuenow={currentTime}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${progress}%`, background: 'var(--primary, #4f98a3)' }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `${progress}%`, background: 'var(--primary, #4f98a3)' }}
                  />
                </div>
                <span className="text-xs tabular-nums" style={{ color: 'white', minWidth: '2.8rem' }}>
                  {formatTime(duration)}
                </span>
              </div>

              {/* Play + Volume */}
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
                  className="p-1 flex-shrink-0"
                  style={{ color: 'white' }}
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button
                  onClick={handleMute}
                  aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                  className="p-1 flex-shrink-0"
                  style={{ color: 'white' }}
                >
                  {isMuted ? <MuteIcon /> : <VolumeIcon />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolume}
                  aria-label="Volume"
                  className="w-20 cursor-pointer"
                  style={{ accentColor: 'var(--primary, #4f98a3)', height: 4 }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
