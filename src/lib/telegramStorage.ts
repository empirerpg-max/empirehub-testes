/**
 * telegramStorage.ts
 * Camada de abstração para o Telegram como storage de mídia.
 *
 * O front NUNCA fala diretamente com o Bot API do Telegram.
 * Toda comunicação passa pelo GAS Web App (VITE_GAS_URL) ou
 * pelo proxy serverless (/api/telegram via telegramBot.ts).
 *
 * Fluxo de upload:
 *   App → POST VITE_GAS_URL (action=uploadArquivo) → GAS → Bot API → salva file_id + URL
 *
 * Fluxo de playback:
 *   audioSrc = "tg:<file_id>" → telegramStreamUrl() → resolveStreamUrl() → <audio src>
 *   A URL de stream real (https://api.telegram.org/file/bot.../...) é salva
 *   diretamente na planilha pelo GAS após o upload, evitando chamadas extras.
 *
 * Para arquivos > 20 MB o GAS deve usar o Local Bot API Server (--local).
 */

const BASE = (import.meta.env.VITE_TELEGRAM_API_BASE as string | undefined ?? '').replace(/\/$/, '')

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

export type TelegramMediaCatalogEntry = TelegramMediaMeta & {
  /** URL direta .mp4/.mp3 gerada pelo GAS após getFile */
  file_url: string
  /** Timestamp ISO da criação do registro */
  created_at: string
}

export type TelegramMediaCatalog = TelegramMediaCatalogEntry[]

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
 *
 * Prioridade de resolução:
 *   1. Se VITE_TELEGRAM_API_BASE estiver definida, usa o proxy serverless.
 *   2. Caso contrário, retorna o prefixo "tg:" para ser resolvido pelo GAS
 *      na primeira reprodução (lazy resolution).
 *
 * Usar como audioSrc no PlayItem: `tg:${file_id}`
 */
export function telegramStreamUrl(srcOrFileId: string): string {
  const id = srcOrFileId.replace(/^tg:/, '')
  if (BASE) return `${BASE}/api/telegram/play/${id}`
  // Fallback: retorna a URL do proxy GAS para resolução lazy
  const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined) ?? ''
  if (GAS_URL) return `${GAS_URL}?action=telegramStream&file_id=${encodeURIComponent(id)}`
  // Último recurso: retorna o src original para o erro aparecer no player
  return srcOrFileId
}

/**
 * Faz upload de um arquivo de mídia para o backend (GAS),
 * que por sua vez envia silenciosamente ao Telegram.
 *
 * Retorna a URL direta do arquivo já resolvida pelo GAS
 * (não requer chamada adicional de getFile no frontend).
 */
export async function uploadToTelegramViaGAS(
  file: File,
  meta: Partial<Pick<TelegramMediaMeta, 'titulo' | 'artista' | 'capa'>>
): Promise<{ file_id: string; file_url: string; thread_id: string }> {
  const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined) ?? ''
  if (!GAS_URL) throw new Error('[telegramStorage] VITE_GAS_URL não definida.')

  // Converte para base64 para compatibilidade com GAS (não aceita multipart nativo)
  const toBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(f)
    })

  const base64 = await toBase64(file)

  const body = {
    action: 'uploadArquivo',
    fileName: file.name,
    mimeType: file.type,
    fileBase64: base64,
    ...meta,
  }

  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`[telegramStorage] Upload GAS erro: HTTP ${res.status}`)

  const json = await res.json() as {
    status: string
    file_id?: string
    file_url?: string
    thread_id?: string
    message?: string
  }

  if (json.status !== 'success') {
    throw new Error(`[telegramStorage] Upload falhou: ${json.message ?? 'erro desconhecido'}`)
  }

  return {
    file_id:   json.file_id   ?? '',
    file_url:  json.file_url  ?? '',
    thread_id: json.thread_id ?? '',
  }
}

/**
 * Lista o catálogo de mídias armazenadas via GAS.
 * O GAS lê a planilha Empire Play e retorna as entradas com file_url resolvida.
 */
export async function getTelegramCatalog(): Promise<TelegramMediaCatalog> {
  const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined) ?? ''
  if (!GAS_URL) {
    console.warn('[telegramStorage] VITE_GAS_URL não definida — catálogo indisponível.')
    return []
  }

  try {
    const res = await fetch(`${GAS_URL}?action=catalogo`)
    if (!res.ok) return []
    const json = await res.json() as { status: string; data?: TelegramMediaCatalog }
    return json.data ?? []
  } catch {
    return []
  }
}
