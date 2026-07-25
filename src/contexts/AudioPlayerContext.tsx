// ============================================================
// AudioPlayerContext — Contexto global do player
// ============================================================
import { createContext, useContext, type ReactNode } from 'react';
import { useAudioPlayer, type AudioPlayerState, type AudioPlayerActions } from '../hooks/useAudioPlayer';

type AudioPlayerContextType = AudioPlayerState & AudioPlayerActions;

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer();
  return (
    <AudioPlayerContext.Provider value={player}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function usePlayer(): AudioPlayerContextType {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('usePlayer deve ser usado dentro de <AudioPlayerProvider>');
  return ctx;
}
