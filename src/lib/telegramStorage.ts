/**
 * telegramStorage.ts
 *
 * Camada de abstração entre o front e a API intermediária do Telegram.
 * O front NUNCA fala diretamente com o Bot API do Telegram.
 *
 * Fluxo:
 *   Front → POST /upload → API intermediária → sendAudio/sendVideo → Telegram
 *   Front → GET  /play/:file_id → API intermediária → getFile → stream
 *   Front → GET  /catalog → API intermediária → catálogo local (DB/JSON)
 */

const BASE =
  (import.meta as any).env?.VITE_TELEGRAM_API_BASE ?? "http://localhost:3001";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TelegramMediaMeta = {
  /** file_id retornado pelo Telegram após upload */
  file_id: string;
  /** message_id da mensagem no canal/grupo de storage */
  message_id: number;
  /** chat_id do canal/grupo de storage */
  chat_id: string;
  mime_type: string;
  file_size: number;
  duration?: number;
  titulo?: string;
  artista?: string;
  /** Drive file-id ou URL pública para a capa */
  capa?: string;
  categoria?: "musica" | "musicvideo" | "video";
  /** Timestamp ISO de quando foi enviado */
  created_at?: string;
};

export type UploadResult =
  | { ok: true; meta: TelegramMediaMeta }
  | { ok: false; error: string };

export type CatalogResult =
  | { ok: true; items: TelegramMediaMeta[] }
  | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retorna a URL de stream para um file_id do Telegram.
 * Usado pelo MiniPlayer como src do <audio>.
 *
 * audioSrc aceita:
 *   - "tg:BQACAgIA..."     → prefixo canônico
 *   - "tg_file:BQACAgIA..." → prefixo alternativo
 *   - "BQACAgIA..."         → file_id puro (sem prefixo)
 */
export function telegramStreamUrl(audioSrc: string): string {
  const id = audioSrc
    .replace(/^tg_file:/, "")
    .replace(/^tg:/, "");
  return `${BASE}/play/${encodeURIComponent(id)}`;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Faz upload de um arquivo de mídia para o Telegram via API intermediária.
 * A API salva o file_id, message_id, chat_id e metadados no catálogo.
 */
export async function uploadToTelegram(
  file: File,
  meta: Partial<Omit<TelegramMediaMeta, "file_id" | "message_id" | "chat_id">>
): Promise<UploadResult> {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("meta", JSON.stringify(meta));

    const res = await fetch(`${BASE}/upload`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { ok: true, meta: data as TelegramMediaMeta };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Busca o catálogo completo de mídias armazenadas no Telegram.
 * Retornado pela API intermediária (não pelo Bot API diretamente).
 */
export async function getTelegramCatalog(): Promise<CatalogResult> {
  try {
    const res = await fetch(`${BASE}/catalog`);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, items: data as TelegramMediaMeta[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Deleta uma mídia do catálogo (não apaga do Telegram — só remove o registro).
 */
export async function deleteTelegramMedia(file_id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/catalog/${encodeURIComponent(file_id)}`, {
      method: "DELETE",
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
