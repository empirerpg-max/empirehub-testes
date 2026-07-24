/**
 * api.ts — helpers de URL para assets de mídia.
 * Espelha o comportamento do app oficial.
 */

/** Thumb do Google Drive (não requer proxy). */
export function driveImg(fileId: string, size = 200): string {
  if (!fileId) return "";
  const id = fileId.includes("/") || fileId.startsWith("http")
    ? fileId.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? fileId
    : fileId;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

/** URL de stream do Drive via proxy. */
export function driveStreamUrl(idOrUrl: string): string {
  const m = String(idOrUrl).match(/\/d\/([a-zA-Z0-9_-]+)/) ||
            String(idOrUrl).match(/id=([a-zA-Z0-9_-]+)/);
  const id = m ? m[1] : idOrUrl.trim();
  return `https://empire-media-api.empirerpg-forum.workers.dev/?id=${id}`;
}
