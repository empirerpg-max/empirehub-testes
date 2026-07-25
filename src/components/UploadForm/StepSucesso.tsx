// StepSucesso — Tela de confirmação após submit bem-sucedido
import { useEffect, useRef } from 'react';
import type { MediaType } from '../../types';

interface StepSucessoProps {
  tipo: MediaType;
  titulo: string;
  threadId: string | null;
  onClose?: () => void;
  onNew: () => void;
}

const EMOJI: Record<MediaType, string> = {
  music: '🎵', album: '💿', clip: '🎬', video: '📺',
};
const LABEL: Record<MediaType, string> = {
  music: 'música', album: 'álbum', clip: 'clipe', video: 'vídeo',
};

export function StepSucesso({ tipo, titulo, threadId, onClose, onNew }: StepSucessoProps) {
  const circleRef = useRef<SVGCircleElement>(null);

  // Animação de check ao montar
  useEffect(() => {
    const c = circleRef.current;
    if (!c) return;
    c.style.strokeDasharray = '100';
    c.style.strokeDashoffset = '100';
    requestAnimationFrame(() => {
      c.style.transition = 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)';
      c.style.strokeDashoffset = '0';
    });
  }, []);

  return (
    <div className="flex flex-col items-center text-center gap-5 py-6">
      {/* Check animado */}
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="34" stroke="var(--border)" strokeWidth="2" />
          <circle
            ref={circleRef}
            cx="36" cy="36" r="34"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
            pathLength="100"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ fontSize: '2rem' }}>{EMOJI[tipo]}</span>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          Publicado com sucesso!
        </h3>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)', maxWidth: '28ch', margin: '0.5rem auto 0' }}>
          Seu {LABEL[tipo]} <strong style={{ color: 'var(--foreground)' }}>{titulo}</strong> foi adicionado ao Empire Play.
        </p>
      </div>

      {/* Neon glow pill */}
      <div className="px-4 py-2 rounded-full text-xs font-medium"
        style={{
          background: 'oklch(from var(--primary) l c h / 0.12)',
          border: '1px solid oklch(from var(--primary) l c h / 0.3)',
          color: 'var(--primary)',
          boxShadow: '0 0 12px oklch(from var(--primary) l c h / 0.2)',
        }}>
        🔴 Disponível no Empire Play agora
      </div>

      {/* Ações */}
      <div className="flex flex-col gap-2 w-full pt-2">
        <button onClick={onNew}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--primary)', color: 'white' }}>
          + Publicar outra mídia
        </button>
        {onClose && (
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}
