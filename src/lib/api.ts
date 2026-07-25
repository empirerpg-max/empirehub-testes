/**
 * api.ts — helpers de URL para assets de mídia.
 *
 * IMPORTANTE: driveStreamUrl foi removida deste arquivo para evitar
 * duplicação com playContext.tsx (que é a fonte única autorizada).
 * Importe sempre de: import { driveStreamUrl } from '@/lib/playContext'
 */

/** Thumb do Google Drive (não requer proxy). */
export function driveImg(fileId: string, size = 200): string {
  if (!fileId) return ''
  const id = fileId.includes('/') || fileId.startsWith('http')
    ? fileId.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? fileId
    : fileId
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`
}

/**
 * @deprecated Use driveStreamUrl de '@/lib/playContext' diretamente.
 * Mantido para não quebrar imports existentes durante a migração.
 */
export { driveStreamUrl } from '@/lib/playContext'
