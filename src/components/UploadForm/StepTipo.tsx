// StepTipo — Step 1: escolha do tipo de conteúdo
import type { MediaType } from '../../types';

interface StepTipoProps {
  onSelect: (tipo: MediaType) => void;
}

const tipos: { tipo: MediaType; emoji: string; label: string; desc: string }[] = [
  { tipo: 'music', emoji: '🎵', label: 'Música', desc: 'Single, promo, lead single...' },
  { tipo: 'album', emoji: '💿', label: 'Álbum / EP', desc: 'Álbum completo, EP, deluxe...' },
  { tipo: 'clip',  emoji: '🎬', label: 'Clipe / MV', desc: 'Clipe oficial, lyric, live...' },
  { tipo: 'video', emoji: '📺', label: 'Vídeo', desc: 'Show, entrevista, bastidores...' },
];

export function StepTipo({ onSelect }: StepTipoProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {tipos.map(({ tipo, emoji, label, desc }) => (
        <button
          key={tipo}
          onClick={() => onSelect(tipo)}
          className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all group"
          style={{
            background: 'var(--secondary, var(--card))',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)';
            (e.currentTarget as HTMLElement).style.background = 'oklch(from var(--primary) l c h / 0.08)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLElement).style.background = 'var(--secondary, var(--card))';
          }}
        >
          <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>{emoji}</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
