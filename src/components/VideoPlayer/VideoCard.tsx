// ============================================================
// VideoCard — Card de vídeo/clipe na listagem
// ============================================================
import { useState } from 'react';
import type { VideoItem } from '../../types';
import { VideoPlayer } from './VideoPlayer';
import { parseYoutubeUrl, isYoutubeUrl } from '../../services/youtubeEmbed';
import { isDriveUrl } from '../../services/googleDrive';

interface VideoCardProps {
  video: VideoItem;
  layout?: 'grid' | 'list';
}

const PlayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

function resolveThumbnail(video: VideoItem): string | null {
  if (video.coverUrl) return video.coverUrl;
  if (isYoutubeUrl(video.videoUrl)) {
    const parsed = parseYoutubeUrl(video.videoUrl);
    return parsed?.thumbnailUrl ?? null;
  }
  return null;
}

function typeLabel(video: VideoItem): string {
  const map: Record<string, string> = {
    Oficial: 'Clipe Oficial',
    Live: 'Ao Vivo',
    'Short Film': 'Curta',
    Concert: 'Show',
    Lyric: 'Lyric Video',
    'Behind the Scenes': 'Bastidores',
  };
  return map[video.videoType ?? ''] ?? video.type.toUpperCase();
}

export function VideoCard({ video, layout = 'grid' }: VideoCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const thumbnail = resolveThumbnail(video);
  const isYT = isYoutubeUrl(video.videoUrl);
  const isDrive = isDriveUrl(video.videoUrl);

  if (layout === 'list') {
    return (
      <>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer group transition-colors"
          style={{ background: 'transparent' }}
          onClick={() => setIsOpen(true)}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setIsOpen(true)}
          aria-label={`Assistir ${video.title}`}
        >
          {/* Thumb */}
          <div className="relative flex-shrink-0 rounded-lg overflow-hidden"
            style={{ width: 80, height: 48, background: 'var(--secondary)' }}>
            {thumbnail ? (
              <img src={thumbnail} alt={video.title}
                width={80} height={48}
                className="w-full h-full object-cover"
                loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">🎬</div>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'oklch(0 0 0 / 50%)' }}>
              <span style={{ color: 'var(--primary)' }}><PlayIcon /></span>
            </div>
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{video.title}</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {video.creatorName ?? video.artist}
              {video.releaseDate && ` • ${video.releaseDate}`}
            </p>
          </div>
          {/* Badge */}
          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
            {typeLabel(video)}
          </span>
        </div>

        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'oklch(0 0 0 / 85%)' }}
            onClick={() => setIsOpen(false)}>
            <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <VideoPlayer video={video} autoPlay onClose={() => setIsOpen(false)} />
            </div>
          </div>
        )}
      </>
    );
  }

  // Layout grid
  return (
    <>
      <div
        className="group cursor-pointer rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={() => setIsOpen(true)}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setIsOpen(true)}
        aria-label={`Assistir ${video.title}`}
      >
        {/* Thumbnail */}
        <div className="relative w-full" style={{ aspectRatio: '16/9', background: 'var(--secondary)' }}>
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={video.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🎬</div>
          )}

          {/* Overlay play */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
            style={{ background: 'oklch(0 0 0 / 50%)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: 'oklch(0 0 0 / 60%)',
                border: '2px solid var(--primary)',
                color: 'var(--primary)',
                boxShadow: '0 0 20px var(--primary)',
              }}>
              <PlayIcon />
            </div>
          </div>

          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'oklch(0 0 0 / 75%)', color: 'var(--primary)' }}>
              {typeLabel(video)}
            </span>
            {isYT && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'oklch(0 0 0 / 75%)', color: 'white' }}>
                YT
              </span>
            )}
            {isDrive && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'oklch(0 0 0 / 75%)', color: 'white' }}>
                Drive
              </span>
            )}
          </div>

          {/* Duração */}
          {video.duration && (
            <span className="absolute bottom-2 right-2 text-xs tabular-nums px-1.5 py-0.5 rounded"
              style={{ background: 'oklch(0 0 0 / 80%)', color: 'white' }}>
              {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="px-3 py-3">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {video.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {video.creatorName ?? video.artist}
            {video.releaseDate && (
              <span> • {new Date(video.releaseDate).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' })}</span>
            )}
          </p>
        </div>
      </div>

      {/* Modal lightbox */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'oklch(0 0 0 / 90%)' }}
          onClick={() => setIsOpen(false)}
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {/* Título acima do player */}
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold" style={{ color: 'white' }}>{video.title}</p>
                <p className="text-sm" style={{ color: 'oklch(1 0 0 / 60%)' }}>
                  {video.creatorName ?? video.artist}
                </p>
              </div>
            </div>
            <VideoPlayer video={video} autoPlay onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
