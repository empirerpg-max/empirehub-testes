/**
 * UploadForm.tsx
 * Formulário de upload com 3 métodos: YouTube | Google Drive | Arquivo → Telegram
 */

import React, { useState, useRef } from 'react';
import { uploadToTelegram }                           from '../../services/telegramBot';
import { parseDriveUrl }                              from '../../services/googleDrive';
import { parseYouTubeUrl, getYouTubeThumbnail }       from '../../services/youtubeEmbed';
import { appendMediaItem, type MediaType }            from '../../services/sheetsAPI';

type UploadMethod = 'youtube' | 'drive' | 'file';

interface FormState {
  method:    UploadMethod;
  mediaType: MediaType;
  titulo:    string;
  artista:   string;
  capaUrl:   string;
  linkUrl:   string;
  file:      File | null;
}

const INITIAL: FormState = {
  method: 'youtube', mediaType: 'musica',
  titulo: '', artista: '', capaUrl: '', linkUrl: '', file: null,
};

const METHOD_LABELS: Record<UploadMethod, string> = {
  youtube: '▶️ Link do YouTube',
  drive:   '📁 Link do Google Drive',
  file:    '📤 Enviar arquivo',
};

export function UploadForm({ onSuccess }: { onSuccess?: () => void }) {
  const [form,    setForm]    = useState<FormState>(INITIAL);
  const [status,  setStatus]  = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const ytInfo  = form.method === 'youtube' && form.linkUrl ? parseYouTubeUrl(form.linkUrl) : null;
  const ytThumb = ytInfo?.isValid ? getYouTubeThumbnail(ytInfo.videoId!, 'hq') : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('uploading');
    setMessage('Processando...');

    try {
      let audioUrl       = '';
      let fileSource     = form.method as 'youtube' | 'drive' | 'telegram';
      let telegramFileId = '';
      let youtubeId      = '';
      let driveFileId    = '';
      let capaUrl        = form.capaUrl;

      if (form.method === 'youtube') {
        const yt = parseYouTubeUrl(form.linkUrl);
        if (!yt.isValid) throw new Error('URL do YouTube inválida.');
        audioUrl  = yt.embedUrl!;
        youtubeId = yt.videoId!;
        if (!capaUrl && yt.videoId) capaUrl = getYouTubeThumbnail(yt.videoId, 'hq') || '';
        fileSource = 'youtube';

      } else if (form.method === 'drive') {
        const drive = parseDriveUrl(form.linkUrl);
        if (!drive.isValid) throw new Error('URL do Google Drive inválida.');
        audioUrl    = drive.playUrl!;
        driveFileId = drive.fileId!;
        fileSource  = 'drive';

      } else {
        if (!form.file) throw new Error('Selecione um arquivo.');
        setMessage('Enviando para o Telegram...');
        const result   = await uploadToTelegram(form.file, `${form.artista} - ${form.titulo}`);
        audioUrl       = result.play_url;
        telegramFileId = result.file_id;
        fileSource     = 'telegram';
      }

      setMessage('Salvando na planilha...');
      await appendMediaItem({
        tipo: form.mediaType, titulo: form.titulo, artista: form.artista,
        capaUrl, audioUrl, fileSource, telegramFileId, youtubeId, driveFileId,
        uploadedAt: new Date().toISOString(), status: 'ready',
      });

      setStatus('success');
      setMessage('✅ Publicado no Empire Play!');
      setForm(INITIAL);
      onSuccess?.();

    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message || 'Erro desconhecido.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="upload-form">
      <h2>Adicionar ao Empire Play</h2>

      <label>Tipo de conteúdo
        <select value={form.mediaType} onChange={e => update({ mediaType: e.target.value as MediaType })}>
          <option value="musica">🎵 Música</option>
          <option value="album">💿 Álbum</option>
          <option value="musicvideo">🎬 Music Video</option>
          <option value="lyricvideo">📝 Lyric Video</option>
          <option value="alternativevideo">🎥 Alternative Video</option>
          <option value="video">▶️ Vídeo</option>
        </select>
      </label>

      <label>Artista
        <input type="text" value={form.artista} onChange={e => update({ artista: e.target.value })}
          placeholder="Nome do artista" required />
      </label>

      <label>Título
        <input type="text" value={form.titulo} onChange={e => update({ titulo: e.target.value })}
          placeholder="Título da música / vídeo" required />
      </label>

      <label>URL da capa <span>(opcional)</span>
        <input type="url" value={form.capaUrl} onChange={e => update({ capaUrl: e.target.value })}
          placeholder="https://..." />
      </label>
      {ytThumb && !form.capaUrl && (
        <p className="thumb-preview">
          Thumbnail detectada:
          <img src={ytThumb} alt="thumbnail do YouTube" width={160} height={90} loading="lazy" />
        </p>
      )}

      <fieldset>
        <legend>Método de upload</legend>
        {(['youtube', 'drive', 'file'] as UploadMethod[]).map(m => (
          <label key={m} className="radio-label">
            <input type="radio" name="method" value={m}
              checked={form.method === m}
              onChange={() => update({ method: m, linkUrl: '', file: null })} />
            {METHOD_LABELS[m]}
          </label>
        ))}
      </fieldset>

      {form.method !== 'file' ? (
        <label>
          {form.method === 'youtube' ? 'URL do YouTube' : 'URL do Google Drive'}
          <input type="url" value={form.linkUrl} onChange={e => update({ linkUrl: e.target.value })}
            placeholder={form.method === 'youtube' ? 'https://youtu.be/...' : 'https://drive.google.com/file/d/...'}
            required />
        </label>
      ) : (
        <label>
          Arquivo (áudio ou vídeo)
          <input ref={fileRef} type="file" accept="audio/*,video/*,.mp3,.mp4,.flac,.wav,.mov"
            onChange={e => update({ file: e.target.files?.[0] ?? null })} required />
          {form.file && <small>{form.file.name} — {(form.file.size / 1024 / 1024).toFixed(1)} MB</small>}
        </label>
      )}

      <button type="submit" disabled={status === 'uploading'}>
        {status === 'uploading' ? '⏳ Enviando...' : 'Publicar no Empire Play'}
      </button>

      {message && <p className={`upload-message upload-message--${status}`}>{message}</p>}
    </form>
  );
}
