// ============================================================
// EMPIRE PLAY — Tipos Centrais
// ============================================================

// ----- Fonte de mídia -----
export type MediaSource = 'youtube' | 'drive' | 'telegram';

// ----- Tipo de conteúdo -----
export type MediaType = 'musica' | 'album' | 'video' | 'clipe';

// ----- Gêneros musicais -----
export type MusicGenre =
  | 'POP'
  | 'RAP/HIP-HOP'
  | 'R&B/SOUL'
  | 'LATIN'
  | 'ALTERNATIVE/ROCK'
  | 'ELETRÔNICO'
  | 'FUNK'
  | 'JAZZ'
  | 'CLÁSSICO'
  | 'OUTRO';

// ----- Tipo de lançamento -----
export type ReleaseType =
  | 'LEAD SINGLE'
  | 'PRÉ-ALBUM'
  | 'ALBUM SINGLE'
  | 'SOLO'
  | 'PARCERIA'
  | 'EP'
  | 'LIVE'
  | 'REMIX';

// ============================================================
// MÚSICA
// ============================================================
export interface MusicItem {
  id: number;
  title: string;          // ex: "Elettra - anywhere"
  artist: string;
  featArtists?: string[];
  releaseDate?: string;   // ISO: "2025-03-31"
  releaseType?: ReleaseType;
  albumName?: string;
  albumId?: number;
  coverUrl?: string;      // URL da capa (Drive uc?export=view)
  audioUrl: string;       // URL de streaming
  source: MediaSource;
  telegramFileId?: string;
  lyrics?: string;
  genre?: MusicGenre;
  topicId?: number;       // ID do tópico no fórum
  creatorId?: number;
  creatorName?: string;
  duration?: number;      // em segundos
}

// ============================================================
// ÁLBUM
// ============================================================
export interface AlbumItem {
  id: number;
  name: string;           // ex: "Dagny - Empty Street"
  artist: string;
  coverUrl?: string;
  releaseDate?: string;
  tracks?: MusicItem[];   // faixas do álbum
  topicId?: number;
  creatorId?: number;
  creatorName?: string;
}

// ============================================================
// VÍDEO / CLIPE
// ============================================================
export type VideoType = 'Oficial' | 'Live' | 'Short Film' | 'Concert' | 'Lyric' | 'Behind the Scenes';

export interface VideoItem {
  id: number;
  title: string;          // ex: "TED - Glass Skin feat. Rose Thompson"
  artist: string;
  releaseDate?: string;
  type: MediaType;        // 'video' | 'clipe'
  videoType?: VideoType;
  coverUrl?: string;      // thumbnail
  videoUrl: string;       // URL de reprodução
  source: MediaSource;
  telegramFileId?: string;
  duration?: number;      // em segundos
  width?: number;
  height?: number;
  topicId?: number;
  creatorId?: number;
  creatorName?: string;
}

// ============================================================
// FÓRUM — Thread & Comentários
// ============================================================
export type ReactionEmoji = '❤️' | '🔥' | '👏' | '😍' | '💯' | '😭' | '🎶' | '⭐';

export interface Reaction {
  emoji: ReactionEmoji;
  count: number;
  reactedByMe: boolean;
}

export interface ForumComment {
  id: number;
  threadId: number;
  authorId: number;
  authorName: string;
  authorAvatar?: string;
  text: string;
  mediaUrl?: string;      // GIF, sticker, imagem
  mediaType?: 'gif' | 'sticker' | 'image';
  reactions: Reaction[];
  replyToId?: number;     // ID do comentário respondido
  createdAt: string;      // ISO datetime
  edited?: boolean;
}

export interface ForumThread {
  id: number;
  mediaType: MediaType;
  mediaId: number;
  title: string;          // ex: "#musica | Elettra - anywhere"
  createdAt: string;
  comments: ForumComment[];
  commentCount: number;
  pinned?: boolean;
}

// ============================================================
// UPLOAD — Formulário
// ============================================================
export interface UploadPayload {
  mediaType: MediaType;
  source: MediaSource;
  title: string;
  artist: string;
  featArtists?: string[];
  coverUrl?: string;
  // Dependendo do source:
  youtubeUrl?: string;     // source === 'youtube'
  driveUrl?: string;       // source === 'drive'
  file?: File;             // source === 'telegram' — arquivo local
  releaseDate?: string;
  releaseType?: ReleaseType;
  albumId?: number;
  genre?: MusicGenre;
  lyrics?: string;
}

// ============================================================
// PLAYER — Estado global
// ============================================================
export interface PlayerState {
  currentItem: MusicItem | VideoItem | null;
  isPlaying: boolean;
  currentTime: number;    // segundos
  duration: number;       // segundos
  volume: number;         // 0 a 1
  isMuted: boolean;
  isFullscreen: boolean;  // somente vídeo
  queue: (MusicItem | VideoItem)[];
  queueIndex: number;
}

// ============================================================
// GOOGLE SHEETS — Linha normalizada
// (formato intermediário na leitura das abas do Sheets)
// ============================================================
export interface SheetsRow {
  [key: string]: string;
}

export interface SheetsResponse<T> {
  data: T[];
  total: number;
  lastUpdated: string;
}
