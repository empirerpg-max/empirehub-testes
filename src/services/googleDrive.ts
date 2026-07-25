// ============================================================
// googleDrive.ts
// Conversão de URLs do Google Drive para reprodução direta
//
// Padrões suportados (conforme Musicas-10.csv):
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

// Converte para URL de download direto (funciona como src de <audio> e <video>)
// Nota: arquivos grandes podem exigir confirmação de vírus no Drive.
// Para melhor confiabilidade, use o upload direto → Telegram.
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

// Converte URL de capa: /view → /uc?export=view (padrão das capas no Musicas-10.csv)
export function driveCapaToImg(url: string): string {
  if (!url) return '';
  // Já está no formato correto
  if (url.includes('uc?export=view') || url.includes('uc?export=download')) return url;
  const preview = driveToPreviewUrl(url);
  return preview || url;
}

// Detecta se a URL é de capa ou de áudio/vídeo
export function detectDriveMediaType(url: string): 'image' | 'media' | 'unknown' {
  if (url.includes('export=view')) return 'image';
  if (url.includes('export=download')) return 'media';
  return 'unknown';
}
