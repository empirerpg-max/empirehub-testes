// ============================================================
// googleDrive.ts
// Conversão de URLs do Google Drive para reprodução direta
//
// Padrões suportados:
//   drive.google.com/file/d/FILE_ID/view?usp=...
//   drive.google.com/open?id=FILE_ID
//   drive.google.com/uc?id=FILE_ID&export=download
// ============================================================

const DRIVE_REGEX = /drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?(?:.*&)?id=([a-zA-Z0-9_-]+)|uc\?(?:.*&)?id=([a-zA-Z0-9_-]+))/;

export function isDriveUrl(url: string): boolean {
  return DRIVE_REGEX.test(url);
}

export function extractDriveId(url: string): string | null {
  const match = url.match(DRIVE_REGEX);
  if (!match) return null;
  return match[1] || match[2] || match[3] || null;
}

// URL de download direto — funciona como src de <video> e <audio>
export function driveToDownloadUrl(url: string): string | null {
  const id = extractDriveId(url);
  if (!id) return null;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

// URL de preview (boa para capas/thumbnails — não força download)
export function driveToPreviewUrl(url: string): string | null {
  const id = extractDriveId(url);
  if (!id) return null;
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

/**
 * Converte URL do Drive para iframe embed.
 * Usa o preview do Drive (/preview) que funciona em iframes sem pop-up de confirmação.
 */
export function driveToEmbedUrl(url: string): string | null {
  const id = extractDriveId(url);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

// Converte URL de capa: /view → /uc?export=view
export function driveCapaToImg(url: string): string {
  if (!url) return '';
  if (url.includes('uc?export=view') || url.includes('uc?export=download')) return url;
  const preview = driveToPreviewUrl(url);
  return preview || url;
}

export function detectDriveMediaType(url: string): 'image' | 'media' | 'unknown' {
  if (url.includes('export=view')) return 'image';
  if (url.includes('export=download')) return 'media';
  return 'unknown';
}
