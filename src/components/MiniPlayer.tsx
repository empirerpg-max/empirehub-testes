// src/components/MiniPlayer.tsx
// MiniPlayer flutuante universal: YouTube / Drive / MP4 (Telegram) / Áudio
import { useEffect, useRef, useState } from 'react';

export type MediaSource = {
  url: string;
  titulo: string;
  capa?: string;
};

type Props = {
  media: MediaSource | null;
  onClose: () => void;
};

type MediaType = 'youtube' | 'drive' | 'mp4' | 'audio' | 'unknown';

function detectType(url: string): MediaType {
  if (/youtu\.be|youtube\.com/.test(url))   return 'youtube';
  if (/drive\.google\.com/.test(url))       return 'drive';
  if (/api\.telegram\.org|\.(mp4|webm)/.test(url)) return 'mp4';
  if (/\.(mp3|ogg|wav|flac|aac)/.test(url)) return 'audio';
  return 'unknown';
}

function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match
    ? `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`
    : url;
}

function getDriveEmbedUrl(url: string): string {
  const match = url.match(/\/d\/([A-Za-z0-9_-]+)/);
  return match
    ? `https://drive.google.com/file/d/${match[1]}/preview`
    : url;
}

export default function MiniPlayer({ media, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging]   = useState(false);
  const [pos, setPos]             = useState({ x: 0, y: 0 });
  const dragStart                 = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  useEffect(() => {
    if (!media) return;
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
    if (audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
    }
  }, [media]);

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: dragStart.current.px + (e.clientX - dragStart.current.mx),
        y: dragStart.current.py + (e.clientY - dragStart.current.my),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  if (!media) return null;

  const tipo = detectType(media.url);

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: pos.y === 0 ? '1.5rem' : undefined,
    right:  pos.x === 0 ? '1.5rem' : undefined,
    top:    pos.y !== 0 ? `calc(100vh - 1.5rem - ${minimized ? 48 : 260}px + ${pos.y}px)` : undefined,
    left:   pos.x !== 0 ? `calc(100vw - 1.5rem - ${minimized ? 220 : 380}px + ${pos.x}px)` : undefined,
    width:  minimized ? '220px' : '380px',
    background: '#0d1117',
    borderRadius: '14px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
    zIndex: 9999,
    overflow: 'hidden',
    transition: dragging ? 'none' : 'width 0.25s ease, box-shadow 0.2s ease',
    border: '1px solid rgba(255,255,255,0.08)',
    userSelect: 'none',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    cursor: 'grab',
    gap: '8px',
  };

  const btnStyle: React.CSSProperties = {
    color: '#8b949e',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    padding: '2px 6px',
    borderRadius: '4px',
    flexShrink: 0,
  };

  return (
    <div style={containerStyle}>
      {/* Header arrastável */}
      <div style={headerStyle} onMouseDown={onMouseDown}>
        <span style={{
          color: '#e6edf3',
          fontSize: '13px',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {tipo === 'audio' ? '🎵' : '🎬'} {media.titulo}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={btnStyle} onClick={() => setMinimized(m => !m)}
            title={minimized ? 'Expandir' : 'Minimizar'}>
            {minimized ? '▲' : '▼'}
          </button>
          <button style={btnStyle} onClick={onClose} title="Fechar">✕</button>
        </div>
      </div>

      {/* Área do player */}
      {!minimized && (
        <div style={{ width: '100%', aspectRatio: tipo === 'audio' ? 'unset' : '16/9', background: '#000' }}>

          {tipo === 'youtube' && (
            <iframe
              src={getYouTubeEmbedUrl(media.url)}
              width="100%" height="100%"
              style={{ border: 'none', display: 'block' }}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}

          {tipo === 'drive' && (
            <iframe
              src={getDriveEmbedUrl(media.url)}
              width="100%" height="100%"
              style={{ border: 'none', display: 'block' }}
              allow="autoplay"
              allowFullScreen
            />
          )}

          {tipo === 'mp4' && (
            <video
              ref={videoRef}
              controls
              style={{ width: '100%', height: '100%', display: 'block' }}
              crossOrigin="anonymous"
            >
              <source src={media.url} type="video/mp4" />
              Seu navegador não suporta vídeo.
            </video>
          )}

          {tipo === 'audio' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '16px', gap: '12px', background: '#0d1117',
            }}>
              {media.capa
                ? <img src={media.capa} alt={media.titulo}
                    style={{ width: '88px', height: '88px', borderRadius: '10px', objectFit: 'cover' }} />
                : <div style={{ width: '88px', height: '88px', borderRadius: '10px',
                    background: '#161b22', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '36px' }}>🎵</div>
              }
              <audio ref={audioRef} controls style={{ width: '100%' }}>
                <source src={media.url} />
              </audio>
            </div>
          )}

          {tipo === 'unknown' && (
            <div style={{ padding: '24px', color: '#8b949e', textAlign: 'center', fontSize: '13px' }}>
              ⚠️ Formato de mídia não reconhecido
            </div>
          )}
        </div>
      )}
    </div>
  );
}
