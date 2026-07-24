/**
 * telegramStorage.ts
 *
 * Camada de abstração para o Telegram como storage de mídia.
 *
 * Arquitetura:
 *   Front/PWA → esta lib → API Intermediária → Telegram Bot API / Local Bot API
 *
 * O front NUNCA fala diretamente com o Telegram.
 * Toda comunicação passa pelos endpoints da API intermediária.
 *
 * Sobre o Local Bot API Server (--local mode):
 *   - Upload até 2000 MB (vs 50 MB no cloud)
 *   - Download sem limite de tamanho (vs 20 MB no cloud)
 *   - getFile retorna file_path absoluto no servidor local
 *   - Requer logOut() no Bot API público antes de migrar
 *   - Em produção: precisa de proxy reverso (nginx/caddy) com TLS
 *
 * Prefixo de audioSrc: "tg:<file_id>"
 * Exemplo: "tg:BQACAgIAAxkBAAIBm2Z..."
 */

// Em dev, aponta para o servidor local. Em produção, troque pelo domínio real.
const TELEGRAM_API_BASE =
  import.meta.env.VITE_TELEGRAM_API_URL ?? 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type TelegramMediaMeta = {
  /** file_id retornado pelo Telegram após upload */
  file_id: string;
  /** message_id da mensagem onde o arquivo foi enviado */
  message_id: number;
  /** chat_id do canal/chat usado como storage */
  chat_id: string;
  /** MIME type do arquivo (audio/mpeg, video/mp4, etc.) */
  mime_type: string;
  /** Tamanho em bytes */
  file_size: number;
  /** Duração em segundos (áudio/vídeo) */
  duration?: number;
  /** Metadados editoriais */
  titulo?: string;
  artista?: string;
  capa?: string;
  categoria?: 'musica' | 'musicvideo' | 'video';
};

export type UploadResult = {
  ok: boolean;
  meta?: TelegramMediaMeta;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Stream URL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna a URL de stream para um file_id do Telegram.
 * A API intermediária resolve getFile e faz proxy do conteúdo.
 *
 * Uso no MiniPlayer: ao detectar mediaType === "telegram",
 * usar esta função para obter a src do <audio>.
 *
 * Nota: no Bot API cloud, getFile gera link válido por ≥1h
 * com limite de download de 20 MB. Para arquivos maiores,
 * use o Local Bot API Server em --local.
 */
export function telegramStreamUrl(fileId: string): string {
  const id = fileId.startsWith('tg:') ? fileId.slice(3) : fileId;
  return `${TELEGRAM_API_BASE}/play/${encodeURIComponent(id)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Faz upload de um arquivo de mídia para o Telegram via API intermediária.
 *
 * A API intermediária:
 *  1. Recebe o arquivo via multipart/form-data
 *  2. Envia para o bot Telegram (sendAudio / sendVideo)
 *  3. Persiste file_id, message_id, chat_id, MIME, tamanho e duração
 *  4. Retorna o TelegramMediaMeta completo
 *
 * Para o audioSrc do PlayItem, use: `tg:${meta.file_id}`
 */
export async function uploadToTelegram(
  file: File,
  meta: Partial<Omit<TelegramMediaMeta, 'file_id' | 'message_id' | 'chat_id' | 'file_size'>>
): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('meta', JSON.stringify(meta));

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/upload`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err };
    }
    const data = await res.json();
    return { ok: true, meta: data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna o catálogo completo de mídias armazenadas no Telegram.
 * O catálogo é persistido pela API intermediária (não no Telegram).
 * Telegram é apenas storage — metadados ficam no banco da API.
 */
export async function getTelegramCatalog(): Promise<TelegramMediaMeta[]> {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/catalog`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/**
 * Busca metadados de um único item pelo file_id.
 */
export async function getTelegramItem(fileId: string): Promise<TelegramMediaMeta | null> {
  try {
    const id = fileId.startsWith('tg:') ? fileId.slice(3) : fileId;
    const res = await fetch(`${TELEGRAM_API_BASE}/catalog/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
