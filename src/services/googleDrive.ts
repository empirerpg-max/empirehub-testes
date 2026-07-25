// ============================================================
// GOOGLE DRIVE — Utiliários de URL
// ============================================================
// O Google Drive tem dois formatos de link relevantes:
//   VIEW:     https://drive.google.com/file/d/FILE_ID/view?usp=...
//   DOWNLOAD: https://drive.google.com/uc?export=download&id=FILE_ID
//   PREVIEW:  https://drive.google.com/file/d/FILE_ID/preview   (embed iframe)
//   THUMB:    https://drive.google.com/uc?export=view&id=FILE_ID (imagem/capa)

/**
 * Extrai o FILE_ID de qualquer URL do Google Drive.
 */
export function extractDriveFileId(url: string): string | null {
  // Formato /file/d/FILE_ID/...
  const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  // Formato ?id=FILE_ID
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  return null;
}

/**
 * Converte URL do Drive para streaming de áudio/vídeo.
 * Usa export=download para que o browser reproduza diretamente.
 * ATENÇÃO: arquivos > ~100MB podem exibir aviso de vírus do Google.
 * Nesses casos, prefira o upload via Telegram.
 */
export function driveToStreamUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

/**
 * Converte URL do Drive para thumbnail/capa (imagem).
 * Usa export=view — ideal para <img src="..." />.
 */
export function driveToImageUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

/**
 * Converte URL do Drive para iframe embed (preview).
 * Ideal para vídeos dentro de <iframe>.
 */
export function driveToEmbedUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

/**
 * Detecta se uma URL é do Google Drive.
 */
export function isDriveUrl(url: string): boolean {
  return url.includes('drive.google.com');
}

/**
 * Resolve a URL final de reprodução a partir de qualquer URL do Drive.
 * Para áudio: usa download direto.
 * Para vídeo: usa preview (iframe embed).
 */
export function resolveDriveUrl(
  url: string,
  mediaType: 'audio' | 'video' | 'image'
): string | null {
  switch (mediaType) {
    case 'audio':
      return driveToStreamUrl(url);
    case 'video':
      return driveToEmbedUrl(url);
    case 'image':
      return driveToImageUrl(url);
    default:
      return driveToStreamUrl(url);
  }
}
