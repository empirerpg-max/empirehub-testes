/**
 * youtubeEmbed.ts
 * Parser de URLs do YouTube → embed seguro via youtube-nocookie.com
 */

export interface YouTubeUrlInfo {
  videoId:    string | null;
  startTime:  number;
  isShort:    boolean;
  isPlaylist: boolean;
  playlistId: string | null;
  embedUrl:   string | null;
  isValid:    boolean;
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const longMatch  = url.match(/(?:youtube\.com|music\.youtube\.com)\/(?:shorts\/|embed\/|v\/|watch\?v=)([a-zA-Z0-9_-]{11})/);
  if (longMatch)  return longMatch[1];
  return null;
}

export function parseYouTubeUrl(url: string): YouTubeUrlInfo {
  const videoId   = extractYouTubeVideoId(url);
  const isShort   = url.includes('/shorts/');
  const tMatch    = url.match(/[?&](?:t|start)=(\d+)/);
  const startTime = tMatch ? parseInt(tMatch[1], 10) : 0;
  const plMatch   = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  const playlistId = plMatch ? plMatch[1] : null;

  if (!videoId) {
    return { videoId: null, startTime: 0, isShort: false, isPlaylist: false, playlistId: null, embedUrl: null, isValid: false };
  }

  const params = new URLSearchParams({ autoplay: '0', controls: '1', modestbranding: '1', rel: '0' });
  if (startTime > 0) params.set('start', String(startTime));
  if (playlistId)    params.set('list',  playlistId);

  return {
    videoId,
    startTime,
    isShort,
    isPlaylist: !!playlistId,
    playlistId,
    embedUrl:  `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`,
    isValid:   true,
  };
}

export function getYouTubeEmbedUrl(url: string): string | null {
  return parseYouTubeUrl(url).embedUrl;
}

export function getYouTubeThumbnail(
  urlOrId: string,
  quality: 'max' | 'hq' | 'mq' | 'sd' = 'hq'
): string | null {
  const id = urlOrId.length === 11 ? urlOrId : extractYouTubeVideoId(urlOrId);
  if (!id) return null;
  const q = { max: 'maxresdefault', hq: 'hqdefault', mq: 'mqdefault', sd: 'sddefault' };
  return `https://i.ytimg.com/vi/${id}/${q[quality]}.jpg`;
}
