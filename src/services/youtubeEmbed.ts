// ============================================================
// youtubeEmbed.ts
// Parse e embed de URLs do YouTube
// Usa youtube-nocookie.com para maior privacidade
// ============================================================
import type { YoutubeParseResult } from '../types';

// Regex cobre:
//   youtube.com/watch?v=ID
//   youtube.com/watch?v=ID&list=...
//   youtu.be/ID
//   youtube.com/shorts/ID
//   youtube.com/embed/ID
//   m.youtube.com/watch?v=ID
const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function isYoutubeUrl(url: string): boolean {
  return YT_REGEX.test(url);
}

export function parseYoutubeUrl(url: string): YoutubeParseResult | null {
  const match = url.match(YT_REGEX);
  if (!match) return null;
  const videoId = match[1];
  return {
    videoId,
    embedUrl:     `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    watchUrl:     `https://www.youtube.com/watch?v=${videoId}`,
  };
}

// Retorna o <iframe> embed pronto pra usar no VideoPlayer
export function getYoutubeIframeSrc(url: string): string | null {
  const parsed = parseYoutubeUrl(url);
  return parsed ? parsed.embedUrl : null;
}

// Thumbnail com fallback (maxresdefault pode não existir para vídeos antigos)
export function getYoutubeThumbnail(url: string, quality: 'max' | 'hq' | 'mq' = 'max'): string | null {
  const parsed = parseYoutubeUrl(url);
  if (!parsed) return null;
  const qMap = { max: 'maxresdefault', hq: 'hqdefault', mq: 'mqdefault' };
  return `https://i.ytimg.com/vi/${parsed.videoId}/${qMap[quality]}.jpg`;
}
