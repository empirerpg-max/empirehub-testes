// ============================================================
// Types globais do Empire Play
// ============================================================

/**
 * ContentType — tipo de conteúdo para upload/GAS/Telegram.
 */
export type ContentType = 'music' | 'album' | 'clip' | 'video'

/** @deprecated Use ContentType. */
export type MediaType = ContentType

export const GAS_CATEGORIA: Record<ContentType, string> = {
  music:  'musicas',
  album:  'musicas',
  clip:   'musicvideos',
  video:  'videos',
}

/**
 * GASConteudoItem — shape bruto retornado pelo GAS (doGet).
 * IMPORTANTE: NÃO usar index signature [key: string]: unknown aqui.
 * Ela contamina os tipos de todos os campos das interfaces filhas,
 * fazendo o TS resolver qualquer propriedade como `unknown`.
 */
export interface GASConteudoItem {
  id_do_topico?: string
  titulo?: string
  nome?: string
  artistas?: string
  criador?: string
  nome_criador?: string
  genero?: string
  tipo_single?: string
  tipo_musica?: string
  tipo_video?: string
  data_lancamento?: string
  capa_url?: string
  thumbnail?: string
  audio_url?: string
  video_url?: string
  telegram_file_id?: string
  telegram_file_url?: string
  source?: 'youtube' | 'drive' | 'telegram'
  letra?: string
  album_vinculado?: string
  // Campos extras conhecidos vindos do GAS — adicione aqui conforme necessário.
  // NÃO usar [key: string]: unknown — quebraria os tipos das interfaces filhas.
  descricao?: string
  duracao?: string
  plays?: string
  likes?: string
  tags?: string
}

/**
 * MusicItem — representa uma faixa de áudio para o player.
 * Todos os campos consumidos por MiniPlayer, FullPlayer e TrackCard
 * são explicitamente tipados aqui para evitar `unknown` / `{}`.
 */
export interface MusicItem {
  // Identificador único (id_do_topico mapeado)
  id: string
  // Exibição
  title: string
  artist: string
  coverUrl?: string
  lyrics?: string
  albumName?: string
  genre?: string
  releaseDate?: string
  // Reprodução
  audioUrl: string
  source: 'youtube' | 'drive' | 'telegram'
  telegramFileId?: string
  // Vídeo opcional (para MiniPlayer flutuante)
  videoSrc?: string
  // Campos brutos do GAS preservados para referência
  raw?: GASConteudoItem
}

/**
 * VideoItem — representa um vídeo para o VideoPlayer.
 */
export interface VideoItem {
  id: string
  title: string
  creator?: string
  thumbnailUrl?: string
  description?: string
  videoUrl: string
  source: 'youtube' | 'drive' | 'telegram'
  telegramFileId?: string
  genre?: string
  releaseDate?: string
  raw?: GASConteudoItem
}

/**
 * mapGASToMusicItem — converte o shape bruto do GAS em MusicItem.
 * Use em sheetsAPI.ts ao receber os dados do doGet.
 */
export function mapGASToMusicItem(item: GASConteudoItem): MusicItem {
  const audioUrl =
    item.telegram_file_url ??
    item.audio_url ??
    ''
  const source: MusicItem['source'] =
    item.source === 'telegram' ? 'telegram' :
    item.source === 'drive'    ? 'drive'    : 'youtube'

  return {
    id:            item.id_do_topico ?? crypto.randomUUID(),
    title:         item.titulo ?? item.nome ?? 'Sem título',
    artist:        item.artistas ?? item.criador ?? item.nome_criador ?? 'Desconhecido',
    coverUrl:      item.capa_url ?? item.thumbnail,
    lyrics:        item.letra,
    albumName:     item.album_vinculado,
    genre:         item.genero,
    releaseDate:   item.data_lancamento,
    audioUrl,
    source,
    telegramFileId: item.telegram_file_id,
    videoSrc:       item.video_url ?? item.telegram_file_url,
    raw:            item,
  }
}

/**
 * mapGASToVideoItem — converte o shape bruto do GAS em VideoItem.
 */
export function mapGASToVideoItem(item: GASConteudoItem): VideoItem {
  const videoUrl =
    item.telegram_file_url ??
    item.video_url ??
    ''
  const source: VideoItem['source'] =
    item.source === 'telegram' ? 'telegram' :
    item.source === 'drive'    ? 'drive'    : 'youtube'

  return {
    id:            item.id_do_topico ?? crypto.randomUUID(),
    title:         item.titulo ?? item.nome ?? 'Sem título',
    creator:       item.criador ?? item.nome_criador,
    thumbnailUrl:  item.thumbnail ?? item.capa_url,
    description:   item.descricao,
    videoUrl,
    source,
    telegramFileId: item.telegram_file_id,
    genre:         item.genero,
    releaseDate:   item.data_lancamento,
    raw:           item,
  }
}

export interface GASComentario {
  id_do_topico: string
  id_jogador?: string
  nome_jogador?: string
  comentario: string
  data?: string
}

export interface TelegramUploadResult {
  file_id: string
  file_unique_id: string
  file_url: string
  file_size?: number
}

export interface YoutubeParseResult {
  videoId: string
  embedUrl: string
  thumbnailUrl: string
  watchUrl: string
}
