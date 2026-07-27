// src/services/api.ts
// Todos os fetches para o Google Apps Script — substitui mocks locais

const GAS_URL = import.meta.env.VITE_GAS_URL as string;

async function gasGet<T>(acao: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ acao, ...params }).toString();
  const res = await fetch(`${GAS_URL}?${query}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Erro na requisição');
  return json.data as T;
}

async function gasPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

// ── Leitura de abas ──────────────────────────────────────────
export const getMusicas        = () => gasGet<unknown[]>('musicas');
export const getMusicVideos    = () => gasGet<unknown[]>('music_videos');
export const getVideos         = () => gasGet<unknown[]>('videos');
export const getAlbuns         = () => gasGet<unknown[]>('albuns');
export const getTop50Spotify   = () => gasGet<unknown[]>('top50spotify');
export const getTopApple       = () => gasGet<unknown[]>('topapple');
export const getTopYT          = () => gasGet<unknown[]>('topyt');

// ── Comentários ──────────────────────────────────────────────
export const getComentarios = (tipo: string, id: string) =>
  gasGet<unknown[]>('getComentarios', { tipo, id });

export const adicionarComentario = (
  tipo: string,
  topico_id: string,
  autor: string,
  texto: string,
  emoji = ''
) => gasPost<{ success: boolean }>({ acao: 'adicionarComentario', tipo, topico_id, autor, texto, emoji });

// ── Upload invisível via Telegram ────────────────────────────
export async function uploadMedia(payload: {
  tipo: string;
  titulo: string;
  artista: string;
  link?: string;
  file?: File;
}): Promise<{ success: boolean; url: string }> {
  let base64 = '';
  let mimeType = '';

  if (payload.file) {
    const buffer = await payload.file.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    // Converte em chunks para evitar stack overflow em arquivos grandes
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    base64   = btoa(binary);
    mimeType = payload.file.type;
  }

  return gasPost<{ success: boolean; url: string }>({
    acao: 'uploadMedia',
    tipo: payload.tipo,
    titulo: payload.titulo,
    artista: payload.artista,
    link: payload.link || '',
    base64,
    mimeType,
  });
}
