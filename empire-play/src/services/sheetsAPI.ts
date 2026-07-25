/**
 * sheetsAPI.ts
 * Google Sheets como banco de dados do Empire Play.
 * Leitura via Sheets API v4 (chave pública).
 * Escrita via Apps Script Web App (proxy).
 */

const API_KEY        = import.meta.env.VITE_SHEETS_API_KEY        as string;
const SPREADSHEET_ID = import.meta.env.VITE_SHEETS_SPREADSHEET_ID as string;
const SCRIPT_URL     = import.meta.env.VITE_GAS_SCRIPT_URL        as string;

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

export type MediaType = 'musica' | 'album' | 'video' | 'musicvideo' | 'lyricvideo' | 'alternativevideo';

export interface MediaItem {
  id:             string;
  tipo:           MediaType;
  titulo:         string;
  artista:        string;
  capaUrl:        string;
  audioUrl:       string;
  fileSource:     'youtube' | 'drive' | 'telegram';
  telegramFileId: string;
  youtubeId:      string;
  driveFileId:    string;
  duracao:        string;
  topicoId:       string;
  uploadedBy:     string;
  uploadedAt:     string;
  status:         'ready' | 'needs_reupload' | 'needs_check';
}

/** Lê uma aba inteira — primeira linha = cabeçalho */
export async function fetchSheet<T = Record<string, string>>(range: string): Promise<T[]> {
  const res  = await fetch(`${BASE}/values/${encodeURIComponent(range)}?key=${API_KEY}`);
  const data = await res.json() as { values?: string[][] };
  if (!data.values || data.values.length < 2) return [];
  const [headers, ...rows] = data.values;
  return rows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h.trim(), (row[i] ?? '').trim()])) as T
  );
}

export const fetchMusicas     = () => fetchSheet<MediaItem>('Musicas-10!A:Z');
export const fetchAlbuns      = () => fetchSheet<MediaItem>('Albuns-4!A:Z');
export const fetchMusicVideos = () => fetchSheet<MediaItem>('Music-Videos-8!A:Z');
export const fetchVideos      = () => fetchSheet<MediaItem>('Videos-6!A:Z');

/** Insere novo item via Apps Script Web App */
export async function appendMediaItem(item: Partial<MediaItem>): Promise<{ success: boolean; row?: number }> {
  if (!SCRIPT_URL) throw new Error('[SheetsAPI] VITE_GAS_SCRIPT_URL não definido.');
  const res  = await fetch(SCRIPT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(item),
  });
  return res.json();
}
