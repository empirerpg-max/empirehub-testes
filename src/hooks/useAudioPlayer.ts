// ============================================================
// useAudioPlayer — Hook central de estado do player de áudio
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import type { MusicItem } from '../types';
import { getTelegramFileUrl } from '../services/telegramBot';
import { driveToStreamUrl, isDriveUrl } from '../services/googleDrive';

export interface AudioPlayerState {
  currentTrack: MusicItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  queue: MusicItem[];
  queueIndex: number;
}

export interface AudioPlayerActions {
  play: (track: MusicItem, queue?: MusicItem[]) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  next: () => void;
  prev: () => void;
  setQueue: (tracks: MusicItem[], startIndex?: number) => void;
}

const DEFAULT_STATE: AudioPlayerState = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  isLoading: false,
  error: null,
  queue: [],
  queueIndex: 0,
};

async function resolveAudioUrl(track: MusicItem): Promise<string> {
  if (track.source === 'telegram' && track.telegramFileId) {
    const info = await getTelegramFileUrl(track.telegramFileId);
    return info.file_url;
  }
  if (track.source === 'drive' || isDriveUrl(track.audioUrl)) {
    return driveToStreamUrl(track.audioUrl) ?? track.audioUrl;
  }
  return track.audioUrl;
}

export function useAudioPlayer(): AudioPlayerState & AudioPlayerActions {
  const [state, setState] = useState<AudioPlayerState>(DEFAULT_STATE);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Garante que o <audio> existe
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
    }
    const audio = audioRef.current;

    const onTimeUpdate = () =>
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
    const onDurationChange = () =>
      setState((s) => ({ ...s, duration: audio.duration || 0 }));
    const onEnded = () => {
      setState((s) => {
        if (s.queueIndex < s.queue.length - 1) {
          return s; // next() será chamado abaixo
        }
        return { ...s, isPlaying: false, currentTime: 0 };
      });
      // Avança fila se houver próxima
      setState((s) => {
        if (s.queueIndex < s.queue.length - 1) {
          return { ...s, queueIndex: s.queueIndex + 1 };
        }
        return s;
      });
    };
    const onWaiting = () => setState((s) => ({ ...s, isLoading: true }));
    const onCanPlay = () => setState((s) => ({ ...s, isLoading: false }));
    const onError = () =>
      setState((s) => ({ ...s, isLoading: false, error: 'Erro ao carregar áudio.' }));
    const onVolumeChange = () =>
      setState((s) => ({ ...s, volume: audio.volume, isMuted: audio.muted }));

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
    audio.addEventListener('volumechange', onVolumeChange);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('volumechange', onVolumeChange);
    };
  }, []);

  // Quando queueIndex muda, troca a faixa automaticamente
  useEffect(() => {
    const track = state.queue[state.queueIndex];
    if (track && track.id !== state.currentTrack?.id) {
      loadAndPlay(track);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.queueIndex]);

  const loadAndPlay = useCallback(async (track: MusicItem) => {
    const audio = audioRef.current;
    if (!audio) return;
    setState((s) => ({ ...s, isLoading: true, error: null, currentTrack: track }));
    // Padding dinâmico no body
    document.documentElement.classList.add('has-player');
    try {
      const url = await resolveAudioUrl(track);
      audio.src = url;
      audio.volume = state.volume;
      audio.muted = state.isMuted;
      await audio.play();
      setState((s) => ({ ...s, isPlaying: true, isLoading: false }));
    } catch {
      setState((s) => ({ ...s, isLoading: false, isPlaying: false, error: 'Não foi possível reproduzir.' }));
    }
  }, [state.volume, state.isMuted]);

  const play = useCallback((track: MusicItem, queue?: MusicItem[]) => {
    const newQueue = queue ?? [track];
    const idx = newQueue.findIndex((t) => t.id === track.id);
    setState((s) => ({ ...s, queue: newQueue, queueIndex: idx >= 0 ? idx : 0 }));
    loadAndPlay(track);
  }, [loadAndPlay]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play();
    setState((s) => ({ ...s, isPlaying: true }));
  }, []);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) pause();
    else resume();
  }, [state.isPlaying, pause, resume]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState((s) => ({ ...s, currentTime: time }));
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      setState((s) => ({ ...s, volume, isMuted: volume === 0 }));
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setState((s) => ({ ...s, isMuted: !s.isMuted }));
    }
  }, []);

  const next = useCallback(() => {
    setState((s) => {
      if (s.queueIndex < s.queue.length - 1)
        return { ...s, queueIndex: s.queueIndex + 1 };
      return s;
    });
  }, []);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    // Se já passou 3s, reinicia a faixa atual
    if (audio && audio.currentTime > 3) {
      seek(0);
      return;
    }
    setState((s) => {
      if (s.queueIndex > 0)
        return { ...s, queueIndex: s.queueIndex - 1 };
      return s;
    });
  }, [seek]);

  const setQueue = useCallback((tracks: MusicItem[], startIndex = 0) => {
    setState((s) => ({ ...s, queue: tracks, queueIndex: startIndex }));
  }, []);

  return {
    ...state,
    play, pause, resume, togglePlay,
    seek, setVolume, toggleMute,
    next, prev, setQueue,
  };
}
