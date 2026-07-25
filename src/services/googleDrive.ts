// ============================================================
// googleDrive.ts
// Conversão de URLs do Google Drive para reprodução direta
// ============================================================

const DRIVE_REGEX = /drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?(?:.*&)?id=([a-zA-Z0-9_-]+)|uc\?(?:.*&)?id=([a-zA-Z0-9_-]+))/

export function isDriveUrl(url: string): boolean {
  return DRIVE_REGEX.test(url)
}

export function extractDriveId(url: string): string | null {
  const match = url.match(DRIVE_REGEX)
  if (!match) return null
  return match[1] || match[2] || match[3] || null
}

export function driveToDownloadUrl(url: string): string | null {
  const id = extractDriveId(url)
  if (!id) return null
  return `https://drive.google.com/uc?export=download&id=${id}`
}

/**
 * Alias exportável usado por useAudioPlayer.ts.
 * Converte URL do Drive para stream direto.
 */
export function driveToStreamUrl(url: string): string | null {
  return driveToDownloadUrl(url)
}

export function driveToPreviewUrl(url: string): string | null {
  const id = extractDriveId(url)
  if (!id) return null
  return `https://drive.google.com/uc?export=view&id=${id}`
}

export function driveToEmbedUrl(url: string): string | null {
  const id = extractDriveId(url)
  if (!id) return null
  return `https://drive.google.com/file/d/${id}/preview`
}

export function driveCapaToImg(url: string): string {
  if (!url) return ''
  if (url.includes('uc?export=view') || url.includes('uc?export=download')) return url
  const preview = driveToPreviewUrl(url)
  return preview || url
}

export function detectDriveMediaType(url: string): 'image' | 'media' | 'unknown' {
  if (url.includes('export=view'))     return 'image'
  if (url.includes('export=download')) return 'media'
  return 'unknown'
}
