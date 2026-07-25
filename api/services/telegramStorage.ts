/**
 * telegramStorage.ts
 * Serviços de storage via Telegram Bot API para o Empire Play.
 *
 * Suporta os 3 métodos de upload:
 *  1. Link do YouTube  → embed youtube-nocookie
 *  2. Link do Drive    → URL de download direto
 *  3. Upload direto    → envia para canal do Telegram, retorna file_id
 */

export type MediaSource = 'youtube' | 'drive' | 'telegram' | 'link';

export interface MediaEntry {
  tipo: 'musica' | 'album' | 'musicvideo' | 'video';
  titulo: string;
  artista: string;
  id_usuario: string;        // Telegram user_id ou ID interno
  capa_url?: string;
  file_source: MediaSource;
  /** URL pronta para o player (embed YT, drive download, ou gerada via getFile) */
  player_url?: string;
  /** Permanente — use para gerar player_url via getTelegramPlayUrl() */
  telegram_file_id?: string;
  telegram_msg_id?: number;
  telegram_chat_id?: string;
}

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_TOKEN;
const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── YouTube ──────────────────────────────────────────────────────────────────
export function parseYoutubeUrl(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&rel=0` : null;
}

// ─── Google Drive ─────────────────────────────────────────────────────────────
export function parseDriveUrl(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const id = match[1];
  // Usar /preview para embed (funciona em iframe), /uc para src direto
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function driveDownloadUrl(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://drive.google.com/uc?export=download&id=${match[1]}`;
}

// ─── Telegram getFile ─────────────────────────────────────────────────────────
/**
 * Gera URL temporária de reprodução a partir de um file_id.
 * Chame no momento do clique no player — não armazene a URL, armazene o file_id.
 */
export async function getTelegramPlayUrl(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/getFile?file_id=${fileId}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.description);
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`;
  } catch (e) {
    console.error('[getTelegramPlayUrl]', e);
    return null;
  }
}

// ─── Upload pelo app → Telegram ───────────────────────────────────────────────
/**
 * Envia um arquivo do usuário para o canal de storage do Telegram.
 * Retorna o file_id permanente para salvar no banco (Sheets / DB).
 *
 * @param file            File object do input[type=file]
 * @param storageChatId   ID do canal de storage (@empireplay_storage ou -100xxx)
 * @param threadId        message_thread_id do tópico (opcional)
 */
export async function uploadToTelegram(
  file: File,
  storageChatId: string,
  threadId?: number
): Promise<{ file_id: string; message_id: number } | null> {
  const form = new FormData();
  form.append('chat_id', storageChatId);
  if (threadId) form.append('message_thread_id', String(threadId));

  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  const fieldName = isVideo ? 'video' : isAudio ? 'audio' : 'document';
  const endpoint  = isVideo ? 'sendVideo' : isAudio ? 'sendAudio' : 'sendDocument';

  form.append(fieldName, file, file.name);

  try {
    const res = await fetch(`${BASE}/${endpoint}`, { method: 'POST', body: form });
    const json = await res.json();
    if (!json.ok) throw new Error(json.description);
    const msg = json.result;
    const media = msg.video ?? msg.audio ?? msg.document;
    return { file_id: media.file_id, message_id: msg.message_id };
  } catch (e) {
    console.error('[uploadToTelegram]', e);
    return null;
  }
}

// ─── Resolver URL de qualquer fonte para o player ────────────────────────────
/**
 * Dado um MediaEntry, retorna a URL pronta para jogar no player.
 * Para Telegram: faz a chamada getFile na hora.
 */
export async function resolvePlayerUrl(entry: MediaEntry): Promise<string | null> {
  switch (entry.file_source) {
    case 'youtube':
      return entry.player_url ?? parseYoutubeUrl(entry.player_url ?? '');
    case 'drive':
      return entry.player_url ?? null;
    case 'telegram':
      if (entry.telegram_file_id) {
        return getTelegramPlayUrl(entry.telegram_file_id);
      }
      return null;
    default:
      return entry.player_url ?? null;
  }
}
