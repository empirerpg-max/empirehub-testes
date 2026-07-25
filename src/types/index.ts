// ============================================================
// Types globais do Empire Play
// ============================================================

/**
 * ContentType — tipo de conteúdo para upload/GAS/Telegram.
 * Não confundir com MediaType de playContext.tsx,
 * que descreve a ORIGEM do stream (drive | youtube | telegram).
 */
export type ContentType = 'music' | 'album' | 'clip' | 'video'

/**
 * @deprecated Use ContentType.
 * Mantido por retrocompatibilidade com imports antigos.
 * Será removido na Fase 2 da refatoração.
 */
export type MediaType = ContentType

// Mapeia ContentType → categoria do GAS (registros2-2.txt)
export const GAS_CATEGORIA: Record<ContentType, string> = {
  music: 'musicas',
  album: 'musicas',   // álbuns usam a mesma sheet por ora
  clip:  'musicvideos',
  video: 'videos',
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
  embedUrl: string          // youtube-nocookie embed
  thumbnailUrl: string      // maxresdefault
  watchUrl: string
}
