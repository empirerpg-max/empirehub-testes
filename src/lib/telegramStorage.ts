/**
 * telegramStorage.ts
 * Camada de abstração para o Telegram como storage de mídia.
 *
 * O front NUNCA fala diretamente com o Bot API do Telegram.
 * Toda comunicação passa pela API intermediária (api/server.js).
 *
 * Fluxo de upload:
 *   App → POST /upload → API → sendAudio/sendVideo (Bot API) → salva file_id
 *
 * Fluxo de playback:
 *   App → GET /play/:fileId → API → getFile → stream de bytes → App
 *   O endpoint /play suporta Range requests — seeking funciona nativamente.
 *
 * Para arquivos > 20 MB a API intermediária deve usar o
 * Local Bot API Server com flag --local (permite download sem limite,
 * upload até 2000 MB e retorna caminho absoluto em file_path).
 */

const BASE = (import.meta.env.VITE_TELEGRAM_API_BASE ?? 'http://localhost:3001').replace(/\/$/, '')

export type TelegramMediaMeta = {
  /** ID único retornado pelo Telegram após upload */
  file_id: string
  /** ID da mensagem no canal de storage */
  message_id: number
  /** ID do canal/chat usado como storage */
  chat_id: string
  mime_type: string
  file_size: number
  duration?: number
  titulo?: string
  artista?: string
  /** Drive file-id ou URL pública para thumb */
  capa?: string
}

/**
 * Verifica se um audioSrc aponta para storage Telegram.
 * Um src Telegram sempre começa com o prefixo "tg:".
 */
export function isTelegramSrc(src: string): boolean {
  return typeof src === 'string' && src.startsWith('tg:')
}

/**
 * Extrai o file_id puro de um audioSrc com prefixo "tg:".
 * Retorna null se o src não for Telegram.
 */
export function parseTelegramFileId(src: string): string | null {
  if (!isTelegramSrc(src)) return null
  return src.slice(3) // remove "tg:"
}

/**
 * Monta a URL de stream para um audioSrc ou file_id do Telegram.
 * Aceita tanto "tg:<file_id>" quanto o file_id puro.
 * Usar como audioSrc no PlayItem: `tg:${file_id}`
 */
export function telegramStreamUrl(srcOrFileId: string): string {
  const id = srcOrFileId.replace(/^tg:/, '')
  return `${BASE}/play/${id}`
}

/**
 * Faz upload de um arquivo de mídia para o Telegram
 * via API intermediária.
 */
export async function uploadToTelegram(
  file: File,
  meta: Partial<Pick<TelegramMediaMeta, 'titulo' | 'artista' | 'capa'>>
): Promise<TelegramMediaMeta> {
  const form = new FormData()
  form.append('file', file)
  form.append('meta', JSON.stringify(meta))
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Upload falhou: HTTP ${res.status}${body ? ` — ${body}` : ''}`)
  }
  return res.json() as Promise<TelegramMediaMeta>
}

/**
 * Lista o catálogo de mídias armazenadas.
 * A API intermediária mantém esse catálogo em SQLite próprio
 * (o Telegram não é banco relacional — apenas storage de bytes).
 */
export async function getTelegramCatalog(): Promise<TelegramMediaMeta[]> {
  const res = await fetch(`${BASE}/catalog`)
  if (!res.ok) throw new Error(`Catálogo indisponível: HTTP ${res.status}`)
  return res.json() as Promise<TelegramMediaMeta[]>
}

/**
 * Registra uma mídia YouTube ou Drive no catálogo sem fazer upload.
 * Útil para unificar o índice de mídia no mesmo SQLite.
 */
export async function registerExternalMedia(
  fileId: string,
  source: 'youtube' | 'drive',
  meta?: Partial<Pick<TelegramMediaMeta, 'titulo' | 'artista' | 'capa' | 'mime_type'>>
): Promise<TelegramMediaMeta> {
  const res = await fetch(`${BASE}/catalog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, source, ...meta }),
  })
  if (!res.ok) throw new Error(`Registro falhou: HTTP ${res.status}`)
  return res.json() as Promise<TelegramMediaMeta>
}

/**
 * Deleta uma entrada do catálogo (não apaga do Telegram, apenas do índice).
 */
export async function deleteTelegramEntry(fileId: string): Promise<void> {
  await fetch(`${BASE}/catalog/${fileId}`, { method: 'DELETE' })
}
