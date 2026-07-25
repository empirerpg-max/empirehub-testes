// ============================================================
// telegramBot.ts
// Acesso ao Telegram via proxy serverless (/api/telegram)
//
// REGRA DE SEGURANÇA: O BOT_TOKEN NUNCA é exposto no frontend.
// Todas as chamadas passam pelo endpoint /api/telegram (proxy)
// ou pelo GAS Web App (VITE_GAS_URL).
//
// Variável necessária no .env do SERVIDOR (não do browser):
//   TELEGRAM_BOT_TOKEN=xxx        ← servidor/GAS apenas
//
// Variáveis do frontend (.env do Vite):
//   VITE_GAS_URL=https://script.google.com/macros/s/.../exec
//   VITE_TELEGRAM_API_BASE=       ← vazio em prod (usa /api relativo)
//                                   http://localhost:3001 em dev local
// ============================================================
import type { ContentType, TelegramUploadResult } from '../types'

// Base do proxy: em prod usa URL relativa; em dev aponta para servidor local
const API_BASE = (import.meta.env.VITE_TELEGRAM_API_BASE as string | undefined) ?? ''

// ─── Gerar URL de reprodução a partir do file_id (via proxy) ─────────────────
export async function getTelegramFileUrl(
  file_id: string
): Promise<{ file_url: string }> {
  const res = await fetch(
    `${API_BASE}/api/telegram/file-url?file_id=${encodeURIComponent(file_id)}`
  )
  if (!res.ok) {
    throw new Error(
      `[telegramBot] getTelegramFileUrl falhou: HTTP ${res.status}. ` +
      'Verifique se o proxy /api/telegram está rodando (VITE_TELEGRAM_API_BASE).'
    )
  }
  const json = await res.json() as { file_url?: string; error?: string }
  if (!json.file_url) {
    throw new Error(
      `[telegramBot] Resposta inválida do proxy: ${json.error ?? 'file_url ausente'}`
    )
  }
  return { file_url: json.file_url }
}

// ─── Renovar URL de um file_id já salvo ──────────────────────────────────────
export async function renewTelegramUrl(file_id: string): Promise<string> {
  const { file_url } = await getTelegramFileUrl(file_id)
  return file_url
}

// ─── Upload de arquivo ────────────────────────────────────────────────────────
function getTgMethod(tipo: ContentType): string {
  switch (tipo) {
    case 'music': return 'sendAudio'
    case 'album': return 'sendAudio'
    case 'clip':  return 'sendVideo'
    case 'video': return 'sendVideo'
    default:      return 'sendDocument'
  }
}

export async function uploadToTelegram(
  file: File,
  tipo: ContentType,
  caption?: string
): Promise<TelegramUploadResult> {
  const method   = getTgMethod(tipo)
  const fieldKey = method === 'sendAudio' ? 'audio' : method === 'sendVideo' ? 'video' : 'document'

  const form = new FormData()
  form.append('method', method)
  form.append('fieldKey', fieldKey)
  form.append('file', file, file.name)
  if (caption) form.append('caption', caption)

  const res = await fetch(`${API_BASE}/api/telegram/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`[telegramBot] Upload erro: HTTP ${res.status}`)
  const json = await res.json() as TelegramUploadResult & { error?: string }
  if (json.error) throw new Error(json.error)

  return json
}
