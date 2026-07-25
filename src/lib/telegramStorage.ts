/**
 * telegramStorage.ts
 * Camada de abstração para o Telegram como storage de mídia.
 *
 * O front NUNCA fala diretamente com o Bot API do Telegram.
 * Toda comunicação passa pelo GAS Web App (VITE_GAS_URL).
 *
 * Fluxo de upload:
 *   App → POST VITE_GAS_URL (action=uploadArquivo) → GAS → Bot API → salva file_id + URL
 *
 * Fluxo de playback:
 *   audioSrc = "tg:<file_id>" → telegramStreamUrl() → <audio src>
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
 */
export function isTelegramSrc(src: string): boolean {
  return typeof src === 'string' && src.startsWith('tg:')
}

/**
 * Extrai o file_id puro de um audioSrc com prefixo "tg:".
 */
export function parseTelegramFileId(src: string): string | null {
  if (!isTelegramSrc(src)) return null
  return src.slice(3)
}

/**
 * Monta a URL de stream para um audioSrc ou file_id do Telegram.
 */
export function telegramStreamUrl(srcOrFileId: string): string {
  const id = srcOrFileId.replace(/^tg:/, '')
  if (BASE) return `${BASE}/api/telegram/play/${id}`
  const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined) ?? ''
  if (GAS_URL) return `${GAS_URL}?action=telegramStream&file_id=${encodeURIComponent(id)}`
  return srcOrFileId
}

/**
 * Faz upload de um arquivo de mídia para o backend (GAS),
 * que por sua vez envia silenciosamente ao Telegram.
 *
 * Retorna a URL direta do arquivo já resolvida pelo GAS.
 */
export async function uploadToTelegramViaGAS(
  file: File,
  meta: Partial<Pick<TelegramMediaMeta, 'titulo' | 'artista' | 'capa'>>
): Promise<{ file_id: string; file_url: string; thread_id: string }> {
  const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined) ?? ''
  if (!GAS_URL) throw new Error('[telegramStorage] VITE_GAS_URL não definida.')

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
 * Alias de compatibilidade — usado em PlayHomePage.tsx.
 * Mantém a mesma assinatura de uploadToTelegramViaGAS.
 */
export const uploadToTelegram = uploadToTelegramViaGAS

/**
 * Lista o catálogo de mídias armazenadas via GAS.
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

/**
 * Remove uma entrada do catálogo via GAS.
 * Envia action=deletarArquivo com o file_id para o backend apagar
 * o registro da planilha Empire Play.
 * (A mensagem no Telegram não é apagada — apenas o registro.)
 */
export async function deleteTelegramEntry(fileId: string): Promise<void> {
  const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined) ?? ''
  if (!GAS_URL) {
    console.warn('[telegramStorage] VITE_GAS_URL não definida — delete ignorado.')
    return
  }

  try {
    await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deletarArquivo', file_id: fileId }),
    })
  } catch (err) {
    console.error('[telegramStorage] Erro ao deletar entrada:', err)
  }
}
