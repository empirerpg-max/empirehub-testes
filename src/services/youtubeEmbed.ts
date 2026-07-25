// ============================================================
// YOUTUBE — Parser e Embed
// ============================================================

/**
 * Extrai o VIDEO_ID de qualquer formato de URL do YouTube.
 * Suporta:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *   https://www.youtube.com/shorts/VIDEO_ID
 *   https://music.youtube.com/watch?v=VIDEO_ID
 */
export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Gera a URL de embed do YouTube (sem cookies, com controles customizáveis).
 * Usa youtube-nocookie.com para privacidade.
 */
export function youtubeEmbedUrl(
  videoId: string,
  options: {
    autoplay?: boolean;
    startAt?: number;     // segundos
    loop?: boolean;
    controls?: boolean;
    mute?: boolean;
  } = {}
): string {
  const params = new URLSearchParams();
  params.set('rel', '0');           // sem vídeos relacionados de outros canais
  params.set('modestbranding', '1'); // logo do YouTube menor
  params.set('enablejsapi', '1');   // habilita YouTube IFrame API
  if (options.autoplay) params.set('autoplay', '1');
  if (options.startAt) params.set('start', String(options.startAt));
  if (options.loop) {
    params.set('loop', '1');
    params.set('playlist', videoId); // loop requer playlist
  }
  if (options.controls === false) params.set('controls', '0');
  if (options.mute) params.set('mute', '1');

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Gera a URL da thumbnail do YouTube.
 * Qualidade: maxresdefault > hqdefault > mqdefault > default
 */
export function youtubeThumbnailUrl(
  videoId: string,
  quality: 'max' | 'hq' | 'mq' | 'default' = 'hq'
): string {
  const qualityMap = {
    max: 'maxresdefault',
    hq: 'hqdefault',
    mq: 'mqdefault',
    default: 'default',
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Detecta se uma URL é do YouTube.
 */
export function isYoutubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

/**
 * Recebe qualquer URL do YouTube e retorna objeto com id + embed + thumbnail.
 * Retorna null se a URL não for válida.
 */
export function parseYoutubeUrl(url: string): {
  id: string;
  embedUrl: string;
  thumbnailUrl: string;
} | null {
  const id = extractYoutubeId(url);
  if (!id) return null;
  return {
    id,
    embedUrl: youtubeEmbedUrl(id),
    thumbnailUrl: youtubeThumbnailUrl(id, 'hq'),
  };
}
