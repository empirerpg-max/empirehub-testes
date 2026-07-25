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
  [key: string]: unknown
}

/**
 * MusicItem — alias de GASConteudoItem para o player de áudio.
 * Campos extras usados pelo useAudioPlayer e MiniPlayer.
 */
export interface MusicItem extends GASConteudoItem {
  id: string
  audioUrl: string
  source: 'youtube' | 'drive' | 'telegram'
  telegramFileId?: string
}

/**
 * VideoItem — alias de GASConteudoItem para o player de vídeo.
 */
export interface VideoItem extends GASConteudoItem {
  id: string
  videoUrl: string
  source: 'youtube' | 'drive' | 'telegram'
}

export interface GASComentario {
  id_do_topico: string
  id_jogador?: string
  nome_jogador?: string
  comentario: string
  data?: string
  [key: string]: unknown
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
