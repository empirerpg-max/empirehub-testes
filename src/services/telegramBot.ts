// ============================================================
// telegramBot.ts
// Acesso ao Telegram via proxy serverless (/api/telegram)
//
// O BOT_TOKEN NUNCA é exposto no frontend.
// Todas as chamadas passam pelo endpoint /api/telegram
// que está em api/server.js (variável de ambiente VITE_TELEGRAM_BOT_TOKEN
// no servidor, não no browser).
//
// Variável necessária no .env (frontend):
//   VITE_TELEGRAM_API_BASE=http://localhost:3001  (dev)
//   (em produção, deixe vazio — usa URL relativa /api)
// ============================================================
import type { MediaType, TelegramUploadResult } from '../types';

// Base do proxy: em dev aponta para o servidor local; em prod usa URL relativa
const API_BASE = (import.meta.env.VITE_TELEGRAM_API_BASE as string | undefined) ?? '';

// ─── Gerar URL de reprodução a partir do file_id (via proxy) ─────────────────
export async function getTelegramFileUrl(
  file_id: string
): Promise<{ file_url: string }> {
  // Tenta primeiro via proxy serverless
  try {
    const res = await fetch(`${API_BASE}/api/telegram/file-url?file_id=${encodeURIComponent(file_id)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.file_url) return { file_url: json.file_url };
    }
  } catch {
    // proxy indisponível — cai no fallback abaixo
  }

  // Fallback: tenta direto com o token exposto no VITE_ (só em dev, nunca em produção)
  const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string | undefined;
  if (BOT_TOKEN) {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(file_id)}`
    );
    if (res.ok) {
      const json = await res.json();
      if (json.ok && json.result?.file_path) {
        return {
          file_url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`,
        };
      }
    }
  }

  throw new Error('Não foi possível obter a URL do arquivo Telegram. Configure VITE_TELEGRAM_BOT_TOKEN ou o proxy /api/telegram.');
}

// ─── Renovar URL de um file_id já salvo ──────────────────────────────────────
export async function renewTelegramUrl(file_id: string): Promise<string> {
  const { file_url } = await getTelegramFileUrl(file_id);
  return file_url;
}

// ─── Upload de arquivo ────────────────────────────────────────────────────────
function getTgMethod(tipo: MediaType): string {
  switch (tipo) {
    case 'music': return 'sendAudio';
    case 'album': return 'sendAudio';
    case 'clip':  return 'sendVideo';
    case 'video': return 'sendVideo';
    default:      return 'sendDocument';
  }
}

export async function uploadToTelegram(
  file: File,
  tipo: MediaType,
  caption?: string
): Promise<TelegramUploadResult> {
  const method   = getTgMethod(tipo);
  const fieldKey = method === 'sendAudio' ? 'audio' : method === 'sendVideo' ? 'video' : 'document';

  const form = new FormData();
  form.append('method', method);
  form.append('fieldKey', fieldKey);
  form.append('file', file, file.name);
  if (caption) form.append('caption', caption);

  const res = await fetch(`${API_BASE}/api/telegram/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload erro: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);

  return json as TelegramUploadResult;
}
