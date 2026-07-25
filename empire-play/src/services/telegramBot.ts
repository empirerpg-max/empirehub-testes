/**
 * telegramBot.ts
 * Upload de arquivos para o Telegram e geração de URLs de reprodução.
 */

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string;
const CHAT_ID   = import.meta.env.VITE_TELEGRAM_CHAT_ID   as string;

export interface TelegramFile {
  file_id:        string;
  file_unique_id: string;
  file_size:      number;
  file_path?:     string;
}

export interface UploadResult {
  file_id:   string;
  play_url:  string;
  file_size: number;
}

/**
 * Converte um file_id permanente em URL temporária de reprodução.
 * O file_id nunca expira; a URL pode ser regenerada a qualquer momento.
 */
export async function getTelegramPlayUrl(file_id: string): Promise<string> {
  const res  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${file_id}`);
  const data = await res.json() as { ok: boolean; result: TelegramFile };
  if (!data.ok || !data.result.file_path) {
    throw new Error(`[TelegramBot] getFile falhou para file_id: ${file_id}`);
  }
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

/**
 * Envia um arquivo para o canal/grupo do Telegram.
 * Retorna o file_id permanente e a URL de reprodução.
 */
export async function uploadToTelegram(file: File, caption: string): Promise<UploadResult> {
  const isAudio = file.type.startsWith('audio/');
  const method  = isAudio ? 'sendAudio' : 'sendDocument';

  const form = new FormData();
  form.append('chat_id', CHAT_ID);
  form.append('caption', caption);
  form.append(isAudio ? 'audio' : 'document', file);

  const res  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: 'POST', body: form });
  const data = await res.json() as { ok: boolean; result: Record<string, unknown> };

  if (!data.ok) throw new Error(`[TelegramBot] Upload falhou: ${JSON.stringify(data)}`);

  const fileObj = data.result[isAudio ? 'audio' : 'document'] as TelegramFile;
  const play_url = await getTelegramPlayUrl(fileObj.file_id);

  return { file_id: fileObj.file_id, play_url, file_size: fileObj.file_size };
}
