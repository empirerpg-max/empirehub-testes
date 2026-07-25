// ============================================================
// FullPlayer — Player expandido (modal/drawer)
// ============================================================
import { usePlayer } from '../../contexts/AudioPlayerContext';
import { ProgressBar } from './ProgressBar';

const PlayIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>;
const PauseIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>;
const PrevIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4" /><rect x="5" y="4" width="3" height="16" rx="1" /></svg>;
const NextIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20" /><rect x="16" y="4" width="3" height="16" rx="1" /></svg>;
const VolumeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>;
const MuteIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>;

interface FullPlayerProps {
  onClose: () => void;
}

export function FullPlayer({ onClose }: FullPlayerProps) {
  const {
    currentTrack, isPlaying, currentTime, duration,
    volume, isMuted, isLoading,
    togglePlay, seek, next, prev, setVolume, toggleMute,
  } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--background)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-safe pt-6 pb-4">
        <button
          onClick={onClose}
          aria-label="Fechar player"
          className="p-2 rounded-full"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="19 15 12 22 5 15" />
          </svg>
        </button>
        <span className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
          Tocando agora
        </span>
        <div style={{ width: 40 }} />
      </div>

      {/* Capa */}
      <div className="flex-1 flex flex-col items-center justify-center px-10 gap-8">
        <div
          className="w-full max-w-xs aspect-square rounded-2xl overflow-hidden shadow-2xl"
          style={{
            boxShadow: currentTrack.coverUrl
              ? '0 20px 60px oklch(0 0 0 / 60%)'
              : '0 20px 60px oklch(0 0 0 / 40%)',
          }}
        >
          {currentTrack.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              style={{
                filter: isPlaying ? 'none' : 'brightness(0.7)',
                transition: 'filter 0.4s ease',
              }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-6xl"
              style={{ background: 'var(--card)' }}
            >
              🎵
            </div>
          )}
        </div>

        {/* Titulo + artista */}
        <div className="text-center w-full">
          <h2 className="text-xl font-bold truncate" style={{ color: 'var(--foreground)' }}>
            {currentTrack.title}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {currentTrack.artist}
            {currentTrack.albumName && (
              <span style={{ color: 'var(--primary)' }}> • {currentTrack.albumName}</span>
            )}
          </p>
        </div>

        {/* Progress */}
        <div className="w-full">
          <ProgressBar currentTime={currentTime} duration={duration} onSeek={seek} />
        </div>

        {/* Controles principais */}
        <div className="flex items-center gap-6">
          <button onClick={prev} aria-label="Anterior" className="p-2 transition-opacity active:opacity-60"
            style={{ color: 'var(--muted-foreground)' }}>
            <PrevIcon />
          </button>

          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              boxShadow: '0 0 32px var(--primary)',
            }}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--primary-foreground)', borderTopColor: 'transparent' }} />
            ) : isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button onClick={next} aria-label="Próxima" className="p-2 transition-opacity active:opacity-60"
            style={{ color: 'var(--muted-foreground)' }}>
            <NextIcon />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <button onClick={toggleMute} aria-label={isMuted ? 'Ativar som' : 'Mutar'}
            style={{ color: 'var(--muted-foreground)' }}>
            {isMuted ? <MuteIcon /> : <VolumeIcon />}
          </button>
          <input
            type="range" min={0} max={1} step={0.02}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume"
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: 'var(--primary)' }}
          />
        </div>

        {/* Letra (se disponível) */}
        {currentTrack.lyrics && (
          <details className="w-full max-w-xs">
            <summary className="text-xs font-medium cursor-pointer mb-3"
              style={{ color: 'var(--primary)' }}>
              Ver letra
            </summary>
            <pre
              className="text-sm whitespace-pre-wrap leading-relaxed"
              style={{ color: 'var(--muted-foreground)', fontFamily: 'inherit' }}
            >
              {currentTrack.lyrics}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
