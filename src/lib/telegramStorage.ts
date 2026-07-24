/**
 * telegramStorage.ts
 * Camada de abstração para o Telegram como storage de mídia.
 *
 * O front NUNCA fala diretamente com o Bot API do Telegram.
 * Toda comunicação passa por esta API intermediária.
 *
 * Fluxo de upload:
 *   App → POST /upload → API → sendAudio/sendVideo (Bot API) → salva file_id
 *
 * Fluxo de playback:
 *   App → GET /play/:fileId → API → getFile → stream de bytes → App
 *
 * Para arquivos > 20 MB, a API intermediária deve usar o
 * Local Bot API Server com flag --local (permite download sem limite,
 * upload até 2000 MB e retorna caminho absoluto em file_path).
 */

const BASE = import.meta.env.VITE_TELEGRAM_API_BASE ?? "http://localhost:3001";

export type TelegramMediaMeta = {
  /** ID único retornado pelo Telegram após upload */
  file_id: string;
  /** ID da mensagem no canal de storage */
  message_id: number;
  /** ID do canal/chat usado como storage */
  chat_id: string;
  mime_type: string;
  file_size: number;
  duration?: number;
  titulo?: string;
  artista?: string;
  /** Drive file-id ou URL pública para thumb */
  capa?: string;
};

/**
 * Monta a URL de stream para um file_id do Telegram.
 * Usar como audioSrc no PlayItem: `tg:${file_id}`
 */
export function telegramStreamUrl(fileId: string): string {
  const id = fileId.replace(/^tg:|^tg_file:/, "");
  return `${BASE}/play/${id}`;
}

/**
 * Faz upload de um arquivo de mídia para o Telegram
 * via API intermediária.
 */
export async function uploadToTelegram(
  file: File,
  meta: Partial<Pick<TelegramMediaMeta, "titulo" | "artista" | "capa">>
): Promise<TelegramMediaMeta> {
  const form = new FormData();
  form.append("file", file);
  form.append("meta", JSON.stringify(meta));
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload falhou: HTTP ${res.status}`);
  return res.json() as Promise<TelegramMediaMeta>;
}

/**
 * Lista o catálogo de mídias armazenadas no Telegram.
 * A API intermediária mantém esse catálogo em banco próprio
 * (o Telegram não é banco relacional — apenas storage).
 */
export async function getTelegramCatalog(): Promise<TelegramMediaMeta[]> {
  const res = await fetch(`${BASE}/catalog`);
  if (!res.ok) throw new Error(`Catálogo indisponível: HTTP ${res.status}`);
  return res.json() as Promise<TelegramMediaMeta[]>;
}

/**
 * Deleta uma entrada do catálogo (não apaga do Telegram, apenas do índice).
 */
export async function deleteTelegramEntry(fileId: string): Promise<void> {
  await fetch(`${BASE}/catalog/${fileId}`, { method: "DELETE" });
}
