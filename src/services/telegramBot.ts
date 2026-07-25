// ============================================================
// TELEGRAM BOT — Upload e Recuperação de Mídia
// ============================================================
// Este serviço se comunica com a API intermediária (api/server.js)
// que roda localmente ou em produção. A API intermediária é
// necessária pois o BOT_TOKEN não deve ficar exposto no frontend.
//
// Fluxo:
//   Frontend → POST /api/upload (FormData com arquivo)
//   API Intermediária → Telegram Bot API (sendDocument/sendVideo/sendAudio)
//   Telegram retorna file_id permanente
//   API Intermediária retorna { file_id, file_url } para o frontend
//   Frontend salva file_id no Google Sheets

const API_BASE = import.meta.env.VITE_TELEGRAM_API_BASE ?? 'http://localhost:3001';

export type TelegramMediaType = 'audio' | 'video' | 'document';

export interface TelegramUploadResult {
  file_id: string;
  file_url: string;
  file_size: number;
  mime_type: string;
}

export interface TelegramFileInfo {
  file_id: string;
  file_path: string;
  file_url: string;
  file_size: number;
}

/**
 * Faz upload de um arquivo para o Telegram via API intermediária.
 * O backend envia ao canal privado e retorna o file_id permanente.
 */
export async function uploadToTelegram(
  file: File,
  mediaType: TelegramMediaType,
  caption?: string
): Promise<TelegramUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('media_type', mediaType);
  if (caption) formData.append('caption', caption);

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message ?? `Upload falhou: ${response.status}`);
  }

  return response.json() as Promise<TelegramUploadResult>;
}

/**
 * Busca a URL temporária de reprodução a partir de um file_id do Telegram.
 * A URL expira, mas o file_id é permanente — pode ser chamado novamente.
 */
export async function getTelegramFileUrl(
  fileId: string
): Promise<TelegramFileInfo> {
  const response = await fetch(
    `${API_BASE}/api/file/${encodeURIComponent(fileId)}`
  );

  if (!response.ok) {
    throw new Error(`Não foi possível obter URL do arquivo: ${response.status}`);
  }

  return response.json() as Promise<TelegramFileInfo>;
}

/**
 * Detecta o TelegramMediaType correto baseado no tipo MIME do arquivo.
 */
export function detectMediaType(file: File): TelegramMediaType {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
}

/**
 * Verifica se um file_id parece válido (formato Telegram).
 */
export function isValidTelegramFileId(fileId: string): boolean {
  return typeof fileId === 'string' && fileId.length > 10;
}
