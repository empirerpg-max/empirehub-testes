/**
 * googleDrive.ts
 * Conversão de URLs do Google Drive para reprodução direta.
 */

export interface DriveUrlInfo {
  fileId:      string | null;
  originalUrl: string;
  playUrl:     string | null;   // Para <video src> / <audio src>
  previewUrl:  string | null;   // Para <iframe> (recomendado para arquivos > 100MB)
  isValid:     boolean;
}

export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const pathMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];
  const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];
  return null;
}

export function parseDriveUrl(url: string): DriveUrlInfo {
  const fileId = extractDriveFileId(url);
  if (!fileId) return { fileId: null, originalUrl: url, playUrl: null, previewUrl: null, isValid: false };
  return {
    fileId,
    originalUrl: url,
    // uc?export=download → src direto em <video> e <audio>
    playUrl:    `https://drive.google.com/uc?export=download&id=${fileId}`,
    // /preview → embed no <iframe> (melhor para vídeos grandes)
    previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
    isValid:    true,
  };
}

/**
 * Retorna a URL de reprodução ideal.
 * usePreview=true para vídeos grandes (evita bloqueio antivírus do Google).
 */
export function getDrivePlayUrl(url: string, usePreview = false): string | null {
  const info = parseDriveUrl(url);
  if (!info.isValid) return null;
  return usePreview ? info.previewUrl : info.playUrl;
}
