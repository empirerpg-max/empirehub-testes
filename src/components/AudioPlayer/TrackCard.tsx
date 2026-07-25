// ============================================================
// TrackCard — Card de música na listagem
// ============================================================
import { usePlayer } from '../../contexts/AudioPlayerContext';
import type { MusicItem } from '../../types';

interface TrackCardProps {
  track: MusicItem;
  queue?: MusicItem[];
  index?: number;
}

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);
const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export function TrackCard({ track, queue, index }: TrackCardProps) {
  const { play, togglePlay, currentTrack, isPlaying } = usePlayer();
  const isActive = currentTrack?.id === track.id;

  function handlePlay() {
    if (isActive) {
      togglePlay();
    } else {
      play(track, queue);
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors group"
      style={{
        background: isActive ? 'oklch(0.78 0.22 145 / 8%)' : 'transparent',
        border: isActive ? '1px solid oklch(0.78 0.22 145 / 20%)' : '1px solid transparent',
      }}
      onClick={handlePlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
      aria-label={`${isActive && isPlaying ? 'Pausar' : 'Reproduzir'} ${track.title}`}
    >
      {/* Número ou ícone de play */}
      <div
        className="w-8 h-8 flex items-center justify-center flex-shrink-0 text-sm tabular-nums"
        style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)' }}
      >
        {isActive && isPlaying ? (
          // Barras animadas de “estocando agora”
          <span className="flex gap-0.5 items-end h-4">
            {[1,2,3].map((i) => (
              <span
                key={i}
                className="w-0.5 rounded-full animate-pulse"
                style={{
                  height: `${[60,100,40][i-1]}%`,
                  background: 'var(--primary)',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </span>
        ) : (
          <span className="group-hover:hidden">{index !== undefined ? index + 1 : ''}</span>
        )}
        <span className={`${isActive && isPlaying ? 'hidden' : 'hidden group-hover:flex'} items-center justify-center`}>
          <PlayIcon />
        </span>
      </div>

      {/* Capa */}
      {track.coverUrl ? (
        <img
          src={track.coverUrl}
          alt={track.title}
          width={40} height={40}
          className="rounded-lg object-cover flex-shrink-0"
          style={{ width: 40, height: 40 }}
          loading="lazy"
        />
      ) : (
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
          style={{ width: 40, height: 40, background: 'var(--secondary)' }}
        >
          🎵
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: isActive ? 'var(--primary)' : 'var(--foreground)' }}
        >
          {track.title}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
          {track.artist}
          {track.albumName && ` • ${track.albumName}`}
        </p>
      </div>

      {/* Gênero */}
      {track.genre && (
        <span
          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:block"
          style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
        >
          {track.genre}
        </span>
      )}

      {/* Botão play (mobile) */}
      <button
        className="p-2 rounded-full flex-shrink-0"
        style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)' }}
        onClick={(e) => { e.stopPropagation(); handlePlay(); }}
        aria-label={isActive && isPlaying ? 'Pausar' : 'Reproduzir'}
      >
        {isActive && isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
    </div>
  );
}
