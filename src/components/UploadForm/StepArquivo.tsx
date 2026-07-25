// StepArquivo — Step 3: método de upload (YouTube / Drive / Telegram)
import { useState, useRef } from 'react';
import type { MediaType } from '../../types';
import type { UploadPayload } from './UploadForm';
import { parseYoutubeUrl, isYoutubeUrl } from '../../services/youtubeEmbed';
import { driveToDownloadUrl, isDriveUrl } from '../../services/googleDrive';

type Source = 'youtube' | 'drive' | 'telegram';

interface StepArquivoProps {
  tipo: MediaType;
  onBack: () => void;
  onSubmit: (data: Partial<UploadPayload>, file?: File) => Promise<void>;
  isLoading: boolean;
}

const ACCEPT: Record<MediaType, string> = {
  music: 'audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/aac,.mp3,.wav,.ogg,.flac',
  album: 'audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg',
  clip:  'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm',
  video: 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm',
};

const SHOW_YOUTUBE: MediaType[] = ['clip', 'video'];
const SHOW_DRIVE:   MediaType[] = ['music', 'album', 'clip', 'video'];
const SHOW_UPLOAD:  MediaType[] = ['music', 'album', 'clip', 'video'];

export function StepArquivo({ tipo, onBack, onSubmit, isLoading }: StepArquivoProps) {
  const showYT     = SHOW_YOUTUBE.includes(tipo);
  const defaultSrc: Source = showYT ? 'youtube' : 'drive';

  const [source, setSource]   = useState<Source>(defaultSrc);
  const [ytUrl, setYtUrl]     = useState('');
  const [ytThumb, setYtThumb] = useState<string | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState('');
  const [driveError, setDriveError] = useState<string | null>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── YouTube: valida e extrai thumb ao mudar URL ──
  function handleYtChange(url: string) {
    setYtUrl(url);
    setYtError(null);
    setYtThumb(null);
    if (!url.trim()) return;
    if (!isYoutubeUrl(url)) { setYtError('URL inválida. Use youtube.com/watch?v=... ou youtu.be/...'); return; }
    const parsed = parseYoutubeUrl(url);
    if (parsed) setYtThumb(parsed.thumbnailUrl);
  }

  // ── Drive: valida URL ──
  function handleDriveChange(url: string) {
    setDriveUrl(url);
    setDriveError(null);
    if (!url.trim()) return;
    if (!isDriveUrl(url)) setDriveError('URL inválida. Cole o link de compartilhamento do Google Drive.');
  }

  // ── Upload direto ──
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileError(null);
    if (!f) return;
    const maxMB = 50;
    if (f.size > maxMB * 1024 * 1024) {
      setFileError(`Arquivo muito grande. Máximo: ${maxMB}MB. Para arquivos maiores, use o link do Drive.`);
      return;
    }
    setFile(f);
  }

  // ── Submit ──
  async function handleSubmit() {
    if (source === 'youtube') {
      if (!ytUrl.trim() || ytError) { setYtError(ytError || 'Cole uma URL do YouTube válida.'); return; }
      await onSubmit({ source: 'youtube', videoUrl: ytUrl, thumbnail: ytThumb || undefined });
    } else if (source === 'drive') {
      if (!driveUrl.trim() || driveError) { setDriveError(driveError || 'Cole um link do Google Drive válido.'); return; }
      const converted = driveToDownloadUrl(driveUrl);
      const key = (tipo === 'music' || tipo === 'album') ? 'audioUrl' : 'videoUrl';
      await onSubmit({ source: 'drive', [key]: converted });
    } else {
      if (!file) { setFileError('Selecione um arquivo para enviar.'); return; }
      setUploadProgress(0);
      await onSubmit({ source: 'telegram' }, file);
      setUploadProgress(null);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '0.5rem',
    borderRadius: '0.5rem',
    fontSize: '0.8rem',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
    background: active ? 'oklch(from var(--primary) l c h / 0.1)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--muted-foreground)',
    transition: 'all 180ms ease',
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs de fonte */}
      <div className="flex gap-2">
        {showYT && (
          <button style={tabStyle(source === 'youtube')} onClick={() => setSource('youtube')}>
            ▶️ YouTube
          </button>
        )}
        <button style={tabStyle(source === 'drive')} onClick={() => setSource('drive')}>
          ☁️ Google Drive
        </button>
        <button style={tabStyle(source === 'telegram')} onClick={() => setSource('telegram')}>
          📤 Upload direto
        </button>
      </div>

      {/* ── YouTube ── */}
      {source === 'youtube' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Cole o link do YouTube. A thumbnail será carregada automaticamente.
          </p>
          <input
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: 'var(--secondary)', border: `1.5px solid ${ytError ? 'var(--destructive, #a12c7b)' : 'var(--border)'}`, color: 'var(--foreground)' }}
            placeholder="https://youtube.com/watch?v=..."
            value={ytUrl}
            onChange={e => handleYtChange(e.target.value)}
          />
          {ytError && <p className="text-xs" style={{ color: 'var(--destructive, #a12c7b)' }}>{ytError}</p>}
          {ytThumb && (
            <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', background: 'var(--secondary)' }}>
              <img src={ytThumb} alt="Thumbnail" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
        </div>
      )}

      {/* ── Google Drive ── */}
      {source === 'drive' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Cole o link de compartilhamento do Google Drive. O arquivo deve estar com acesso público ou "qualquer pessoa com o link".
          </p>
          <input
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: 'var(--secondary)', border: `1.5px solid ${driveError ? 'var(--destructive, #a12c7b)' : 'var(--border)'}`, color: 'var(--foreground)' }}
            placeholder="https://drive.google.com/file/d/..."
            value={driveUrl}
            onChange={e => handleDriveChange(e.target.value)}
          />
          {driveError && <p className="text-xs" style={{ color: 'var(--destructive, #a12c7b)' }}>{driveError}</p>}
          {driveUrl && !driveError && (
            <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'oklch(from var(--primary) l c h / 0.08)', color: 'var(--primary)' }}>
              ✅ Link válido. URL convertida para reprodução direta.
            </div>
          )}
        </div>
      )}

      {/* ── Upload direto → Telegram ── */}
      {source === 'telegram' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            O arquivo será enviado ao bot do Empire e armazenado gratuitamente no Telegram. Tamanho máximo: 50MB.
          </p>
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all"
            style={{ border: '2px dashed var(--border)', minHeight: 120, padding: '1.5rem' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const fakeE = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>; handleFile(fakeE); } }}
          >
            {file ? (
              <>
                <span style={{ fontSize: '2rem' }}>{tipo === 'music' || tipo === 'album' ? '🎵' : '🎬'}</span>
                <p className="text-sm font-medium text-center" style={{ color: 'var(--foreground)' }}>{file.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </>
            ) : (
              <>
                <span style={{ fontSize: '2rem', opacity: 0.5 }}>📁</span>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Clique ou arraste o arquivo aqui</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>
                  {tipo === 'music' || tipo === 'album' ? 'MP3, WAV, OGG, FLAC' : 'MP4, MOV, WEBM'}
                </p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept={ACCEPT[tipo]} className="sr-only" onChange={handleFile} />
          {fileError && <p className="text-xs" style={{ color: 'var(--destructive, #a12c7b)' }}>{fileError}</p>}

          {/* Progresso de upload */}
          {uploadProgress !== null && (
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
                <span>Enviando para o Telegram...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%`, background: 'var(--primary)' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 pt-1">
        <button onClick={onBack} disabled={isLoading}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
          ← Voltar
        </button>
        <button onClick={handleSubmit} disabled={isLoading}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          style={{ background: isLoading ? 'oklch(from var(--primary) l c h / 0.6)' : 'var(--primary)', color: 'white' }}>
          {isLoading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
          ) : '🚀 Publicar'}
        </button>
      </div>
    </div>
  );
}
