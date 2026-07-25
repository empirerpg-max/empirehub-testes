// ============================================================
// GOOGLE SHEETS API — Leitura e escrita das abas do Empire Play
// ============================================================
// Usa a Google Sheets API v4 pública (apenas leitura com API Key)
// Para escrita, usa o endpoint da API intermediária (via service account).
//
// Mapeamento de abas:
//   Musicas-10        → músicas
//   Albuns-4          → álbuns
//   Music-Videos-8    → clipes
//   Videos-6          → vídeos
//   Comentarios_Musicas-9   → comentários de músicas
//   Comentarios_Albuns-3    → comentários de álbuns
//   Comentarios_MV-7        → comentários de clipes
//   Comentarios_Videos-5    → comentários de vídeos

import type { MusicItem, AlbumItem, VideoItem, ForumComment, MediaType } from '../types';
import { isDriveUrl, driveToStreamUrl, driveToImageUrl } from './googleDrive';
import { isYoutubeUrl, parseYoutubeUrl } from './youtubeEmbed';
import { isValidTelegramFileId } from './telegramBot';

const API_BASE = import.meta.env.VITE_TELEGRAM_API_BASE ?? 'http://localhost:3001';

// ---- Helpers de normalização ----

/**
 * Detecta a source de uma URL de mídia.
 */
function detectSource(url: string): 'youtube' | 'drive' | 'telegram' {
  if (isYoutubeUrl(url)) return 'youtube';
  if (isDriveUrl(url)) return 'drive';
  if (isValidTelegramFileId(url)) return 'telegram';
  return 'drive'; // fallback
}

/**
 * Resolve a URL de áudio para reprodução direta.
 */
function resolveAudioUrl(raw: string): string {
  if (isDriveUrl(raw)) return driveToStreamUrl(raw) ?? raw;
  return raw;
}

/**
 * Resolve a URL de capa/thumbnail.
 */
function resolveCoverUrl(raw: string): string {
  if (isDriveUrl(raw)) return driveToImageUrl(raw) ?? raw;
  if (isYoutubeUrl(raw)) {
    const parsed = parseYoutubeUrl(raw);
    return parsed?.thumbnailUrl ?? raw;
  }
  return raw;
}

// ---- Parsers das linhas do Sheets ----

/**
 * Converte uma linha bruta do CSV/Sheets de Músicas em MusicItem.
 * Colunas esperadas (baseadas no arquivo Musicas-10.csv):
 *   Data de lançamento, ID, URL, Capa, Letra, ID_Forum, ID Criador,
 *   Nome, Tipo de lançamento, Tipo, Album, Artista1, Artista2, ..., Gênero
 */
export function parseMusicRow(row: Record<string, string>): MusicItem {
  const rawUrl = row['URL'] ?? row['url'] ?? '';
  const rawCover = row['Capa'] ?? row['capa'] ?? '';
  return {
    id: parseInt(row['ID'] ?? row['id'] ?? '0', 10),
    title: row['Nome'] ?? row['nome'] ?? '',
    artist: row['Artista1'] ?? row['artista'] ?? '',
    releaseDate: row['Data de lançamento'] || undefined,
    releaseType: (row['Tipo de lançamento'] as MusicItem['releaseType']) || undefined,
    albumName: row['Album'] || undefined,
    coverUrl: rawCover ? resolveCoverUrl(rawCover) : undefined,
    audioUrl: resolveAudioUrl(rawUrl),
    source: detectSource(rawUrl),
    lyrics: row['Letra'] || undefined,
    genre: (row['Gênero'] as MusicItem['genre']) || undefined,
    topicId: row['ID_Forum'] ? parseInt(row['ID_Forum'], 10) : undefined,
    creatorId: row['ID Criador'] ? parseInt(row['ID Criador'], 10) : undefined,
    creatorName: row['Nome do criador'] || undefined,
  };
}

/**
 * Converte uma linha bruta de Álbuns em AlbumItem.
 */
export function parseAlbumRow(row: Record<string, string>): AlbumItem {
  return {
    id: parseInt(row['ID do tópico'] ?? '0', 10),
    name: row['Nome'] ?? '',
    artist: (row['Nome do criador'] ?? '').split(' - ')[0] ?? '',
    coverUrl: row['Capa'] ? resolveCoverUrl(row['Capa']) : undefined,
    releaseDate: row['Data de lançamento'] || undefined,
    topicId: row['ID do tópico'] ? parseInt(row['ID do tópico'], 10) : undefined,
    creatorId: row['ID do Criador'] ? parseInt(row['ID do Criador'], 10) : undefined,
    creatorName: row['Nome do criador'] || undefined,
  };
}

/**
 * Converte uma linha bruta de Music Videos/Videos em VideoItem.
 */
export function parseVideoRow(
  row: Record<string, string>,
  mediaType: MediaType = 'clipe'
): VideoItem {
  const rawUrl = row['URL'] ?? row['url'] ?? row['ID do arquivo'] ?? '';
  const rawCover = row['Thumb'] ?? row['Capa'] ?? row['thumb'] ?? '';
  return {
    id: parseInt(row['ID do tópico'] ?? row['ID'] ?? '0', 10),
    title: row['Nome'] ?? '',
    artist: (row['Nome'] ?? '').split(' - ')[0] ?? '',
    releaseDate: row['Data de lançamento'] || undefined,
    type: mediaType,
    videoType: (row['Tipo'] as VideoItem['videoType']) ?? 'Oficial',
    coverUrl: rawCover ? resolveCoverUrl(rawCover) : undefined,
    videoUrl: rawUrl,
    source: detectSource(rawUrl),
    topicId: row['ID do tópico'] ? parseInt(row['ID do tópico'], 10) : undefined,
    creatorId: row['ID do Criador'] ? parseInt(row['ID do Criador'], 10) : undefined,
    creatorName: row['Nome do criador'] || undefined,
  };
}

// ---- Fetchers (via API intermediária) ----

/**
 * Busca todas as músicas da aba Musicas-10.
 */
export async function fetchMusicas(): Promise<MusicItem[]> {
  const res = await fetch(`${API_BASE}/api/sheets/musicas`);
  if (!res.ok) throw new Error('Erro ao buscar músicas');
  const rows: Record<string, string>[] = await res.json();
  return rows.map(parseMusicRow);
}

/**
 * Busca todos os álbuns da aba Albuns-4.
 */
export async function fetchAlbuns(): Promise<AlbumItem[]> {
  const res = await fetch(`${API_BASE}/api/sheets/albuns`);
  if (!res.ok) throw new Error('Erro ao buscar álbuns');
  const rows: Record<string, string>[] = await res.json();
  return rows.map(parseAlbumRow);
}

/**
 * Busca todos os clipes da aba Music-Videos-8.
 */
export async function fetchClipes(): Promise<VideoItem[]> {
  const res = await fetch(`${API_BASE}/api/sheets/clipes`);
  if (!res.ok) throw new Error('Erro ao buscar clipes');
  const rows: Record<string, string>[] = await res.json();
  return rows.map((r) => parseVideoRow(r, 'clipe'));
}

/**
 * Busca os comentários de um tópico específico.
 */
export async function fetchComments(
  topicId: number,
  mediaType: MediaType
): Promise<ForumComment[]> {
  const res = await fetch(
    `${API_BASE}/api/sheets/comentarios?topicId=${topicId}&type=${mediaType}`
  );
  if (!res.ok) throw new Error('Erro ao buscar comentários');
  return res.json() as Promise<ForumComment[]>;
}

/**
 * Adiciona uma nova linha ao Sheets (música, álbum, vídeo ou clipe).
 * Requer a API intermediária com service account configurado.
 */
export async function appendToSheets(
  mediaType: MediaType,
  data: Record<string, string | number>
): Promise<{ success: boolean; rowIndex: number }> {
  const res = await fetch(`${API_BASE}/api/sheets/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaType, data }),
  });
  if (!res.ok) throw new Error('Erro ao salvar no Sheets');
  return res.json();
}
