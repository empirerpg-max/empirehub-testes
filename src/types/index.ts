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
 *
 * IMPORTANTE: NÃO usar index signature [key: string]: unknown.
 * Ela contamina os tipos de todos os campos das interfaces filhas,
 * fazendo o TS resolver qualquer propriedade como `unknown`.
 * Adicione campos extras explicitamente conforme necessário.
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
  // Campos extras do GAS — adicione aqui conforme novas colunas surgirem
  descricao?: string
  duracao?: string     // string "3:45" ou segundos em string
  duracao_segundos?: string
  plays?: string
  likes?: string
  tags?: string
}

/**
 * MusicItem — faixa de áudio para o player.
 * Todos os campos consumidos por MiniPlayer, FullPlayer e TrackCard
 * são explicitamente tipados aqui.
 */
export interface MusicItem {
  id: string
  title: string
  artist: string
  coverUrl?: string
  lyrics?: string
  albumName?: string
  genre?: string
  releaseDate?: string
  audioUrl: string
  source: 'youtube' | 'drive' | 'telegram'
  telegramFileId?: string
  videoSrc?: string
  raw?: GASConteudoItem
}

/**
 * VideoItem — vídeo/clipe para o VideoPlayer e VideoCard.
 *
 * Campos mapeados para compatibilidade com VideoCard.tsx existente:
 * - coverUrl      ← capa_url / thumbnail
 * - artist        ← artistas (fallback de creator)
 * - creatorName   ← criador / nome_criador
 * - type          ← genero (usado como categoria geral do card)
 * - videoType     ← tipo_video (Oficial, Live, Lyric, etc.)
 * - duration      ← duracao_segundos em número
 */
export interface VideoItem {
  id: string
  title: string
  // Criador / canal
  creator?: string
  creatorName?: string
  artist?: string
  // Mídia
  thumbnailUrl?: string
  coverUrl?: string      // alias de thumbnailUrl — VideoCard usa este
  description?: string
  videoUrl: string
  source: 'youtube' | 'drive' | 'telegram'
  telegramFileId?: string
  // Metadados
  genre?: string
  releaseDate?: string
  type?: string          // categoria geral (Music Video, Documentário, etc.)
  videoType?: string     // tipo específico (Oficial, Live, Lyric, Short Film, etc.)
  duration?: number      // duração em segundos (para exibir no badge do card)
  raw?: GASConteudoItem
}

/**
 * mapGASToMusicItem — converte shape bruto do GAS em MusicItem.
 * Use em sheetsAPI.ts ao processar retorno do doGet para Musicas / Music Videos.
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
    id:             item.id_do_topico ?? crypto.randomUUID(),
    title:          item.titulo ?? item.nome ?? 'Sem título',
    artist:         item.artistas ?? item.criador ?? item.nome_criador ?? 'Desconhecido',
    coverUrl:       item.capa_url ?? item.thumbnail,
    lyrics:         item.letra,
    albumName:      item.album_vinculado,
    genre:          item.genero,
    releaseDate:    item.data_lancamento,
    audioUrl,
    source,
    telegramFileId: item.telegram_file_id,
    videoSrc:       item.video_url ?? item.telegram_file_url,
    raw:            item,
  }
}

/**
 * mapGASToVideoItem — converte shape bruto do GAS em VideoItem.
 * Use em sheetsAPI.ts ao processar retorno do doGet para Videos / Music Videos.
 */
export function mapGASToVideoItem(item: GASConteudoItem): VideoItem {
  const videoUrl =
    item.telegram_file_url ??
    item.video_url ??
    ''
  const source: VideoItem['source'] =
    item.source === 'telegram' ? 'telegram' :
    item.source === 'drive'    ? 'drive'    : 'youtube'

  // Duração: aceita "3:45" ou "225" (segundos como string)
  let duration: number | undefined
  if (item.duracao_segundos) {
    duration = parseInt(item.duracao_segundos, 10) || undefined
  } else if (item.duracao) {
    const parts = item.duracao.split(':')
    if (parts.length === 2) {
      duration = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
    } else {
      duration = parseInt(item.duracao, 10) || undefined
    }
  }

  const creatorName = item.criador ?? item.nome_criador
  const coverUrl    = item.capa_url ?? item.thumbnail

  return {
    id:             item.id_do_topico ?? crypto.randomUUID(),
    title:          item.titulo ?? item.nome ?? 'Sem título',
    creator:        creatorName,
    creatorName,
    artist:         item.artistas ?? creatorName,
    thumbnailUrl:   coverUrl,
    coverUrl,
    description:    item.descricao,
    videoUrl,
    source,
    telegramFileId: item.telegram_file_id,
    genre:          item.genero,
    releaseDate:    item.data_lancamento,
    type:           item.genero,
    videoType:      item.tipo_video,
    duration,
    raw:            item,
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
