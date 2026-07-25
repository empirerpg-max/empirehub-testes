// ============================================================
// MiniPlayer — Player fixo no rodapé (estilo Spotify)
// ============================================================
import { usePlayer } from '../../contexts/AudioPlayerContext';
import { ProgressBar } from './ProgressBar';

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);
const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);
const PrevIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="19,20 9,12 19,4" />
    <rect x="5" y="4" width="3" height="16" rx="1" />
  </svg>
);
const NextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,4 15,12 5,20" />
    <rect x="16" y="4" width="3" height="16" rx="1" />
  </svg>
);

export function MiniPlayer() {
  const { currentTrack, isPlaying, currentTime, duration, togglePlay, seek, next, prev, isLoading } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe"
      style={{
        background: 'linear-gradient(to top, var(--background) 60%, transparent)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      {/* Barra de progresso no topo do MiniPlayer */}
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        onSeek={seek}
        className="mb-2"
      />

      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: '0 -4px 32px oklch(0 0 0 / 40%)',
        }}
      >
        {/* Capa */}
        <div className="relative flex-shrink-0">
          {currentTrack.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              width={44}
              height={44}
              className="rounded-lg object-cover"
              style={{ width: 44, height: 44 }}
            />
          ) : (
            <div
              className="rounded-lg flex items-center justify-center text-lg"
              style={{ width: 44, height: 44, background: 'var(--secondary)' }}
            >
              🎵
            </div>
          )}
          {/* Indicador de loading */}
          {isLoading && (
            <div className="absolute inset-0 rounded-lg flex items-center justify-center"
              style={{ background: 'oklch(0 0 0 / 60%)' }}>
              <div className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {currentTrack.title}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            {currentTrack.artist}
          </p>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={prev}
            aria-label="Faixa anterior"
            className="p-2 rounded-full transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <PrevIcon />
          </button>

          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            onClick={next}
            aria-label="Próxima faixa"
            className="p-2 rounded-full transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <NextIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
