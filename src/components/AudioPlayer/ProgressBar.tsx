// ============================================================
// ProgressBar — Barra de progresso interativa
// ============================================================
import { useRef, type PointerEvent } from 'react';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
}

function formatTime(s: number): string {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function ProgressBar({ currentTime, duration, onSeek, className = '' }: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  function handleClick(e: PointerEvent<HTMLDivElement>) {
    const bar = barRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(duration, ratio * duration)));
  }

  return (
    <div className={`flex items-center gap-2 w-full ${className}`}>
      <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)', minWidth: '2.5rem', textAlign: 'right' }}>
        {formatTime(currentTime)}
      </span>

      {/* Barra */}
      <div
        ref={barRef}
        onPointerDown={handleClick}
        className="relative flex-1 h-1 rounded-full cursor-pointer group"
        style={{ background: 'oklch(1 0 0 / 15%)' }}
        role="slider"
        aria-label="Progressó da música"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
      >
        {/* Preenchimento */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
          style={{ width: `${progress}%`, background: 'var(--primary)' }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%`, background: 'var(--primary)', boxShadow: '0 0 6px var(--primary)' }}
        />
      </div>

      <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)', minWidth: '2.5rem' }}>
        {formatTime(duration)}
      </span>
    </div>
  );
}
