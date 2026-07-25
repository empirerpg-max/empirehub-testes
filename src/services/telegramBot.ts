// ============================================================
// telegramBot.ts
// Upload de arquivos via Telegram Bot API
//
// BOT_TOKEN deve ser definido em .env:
//   VITE_TELEGRAM_BOT_TOKEN=123456:ABCdef...
//   VITE_TELEGRAM_CHAT_ID=-100xxxxxxxxxx  (ID do canal/grupo)
//
// Fluxo:
//   1. sendDocument / sendAudio / sendVideo para o chat de armazenamento
//   2. Retorna file_id (permanente) + URL temporária via getFile
//   3. file_id é salvo no Sheets — URL pode ser renovada a qualquer momento
// ============================================================
import type { MediaType, TelegramUploadResult } from '../types';

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string;
const CHAT_ID   = import.meta.env.VITE_TELEGRAM_CHAT_ID   as string;
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;

if ((!BOT_TOKEN || !CHAT_ID) && import.meta.env.DEV) {
  console.warn('[telegramBot] VITE_TELEGRAM_BOT_TOKEN ou VITE_TELEGRAM_CHAT_ID não definidos.');
}

// ─── Método do Telegram por tipo de mídia ────────────────────────────────────
function getTgMethod(tipo: MediaType): string {
  switch (tipo) {
    case 'music': return 'sendAudio';
    case 'album': return 'sendAudio';
    case 'clip':  return 'sendVideo';
    case 'video': return 'sendVideo';
    default:      return 'sendDocument';
  }
}

// ─── Upload de arquivo ────────────────────────────────────────────────────────
export async function uploadToTelegram(
  file: File,
  tipo: MediaType,
  caption?: string
): Promise<TelegramUploadResult> {
  const method  = getTgMethod(tipo);
  const fieldKey = method === 'sendAudio' ? 'audio' : method === 'sendVideo' ? 'video' : 'document';

  const form = new FormData();
  form.append('chat_id', CHAT_ID);
  form.append(fieldKey, file, file.name);
  if (caption) form.append('caption', caption);

  const res = await fetch(`${TG_API}/${method}`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Telegram upload erro: ${res.status}`);
  const json = await res.json();

  if (!json.ok) throw new Error(json.description || 'Erro no Telegram Bot API');

  // Extrai o file_id do resultado
  const msg = json.result;
  const mediaObj = msg.audio || msg.video || msg.document;
  if (!mediaObj) throw new Error('Telegram não retornou objeto de mídia');

  const file_id = mediaObj.file_id as string;
  const file_url = await getTelegramFileUrl(file_id);

  return {
    file_id,
    file_unique_id: mediaObj.file_unique_id as string,
    file_url,
    file_size: mediaObj.file_size as number | undefined,
  };
}

// ─── Gerar URL temporária de reprodução a partir do file_id ──────────────────
export async function getTelegramFileUrl(file_id: string): Promise<string> {
  const res  = await fetch(`${TG_API}/getFile?file_id=${encodeURIComponent(file_id)}`);
  if (!res.ok) throw new Error(`Telegram getFile erro: ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.description || 'Erro ao obter URL do Telegram');
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`;
}

// ─── Renovar URL de um file_id já salvo no Sheets ────────────────────────────
// Use quando a URL expirou e precisa gerar uma nova para o player
export async function renewTelegramUrl(file_id: string): Promise<string> {
  return getTelegramFileUrl(file_id);
}
