// ============================================================
// UploadForm — Wizard 3 steps para upload de mídia
// ============================================================
import { useState, useRef } from 'react';
import type { MediaType } from '../../types';
import { StepTipo } from './StepTipo';
import { StepMetadados } from './StepMetadados';
import { StepArquivo } from './StepArquivo';
import { StepSucesso } from './StepSucesso';
import { submitToGAS } from '../../services/sheetsAPI';
import { uploadToTelegram } from '../../services/telegramBot';

export type UploadStep = 'tipo' | 'metadados' | 'arquivo' | 'sucesso';

export interface UploadPayload {
  tipo: MediaType;
  titulo?: string;
  artistas?: string[];
  genero?: string;
  tipoSingle?: string;
  tipoMusica?: string;
  albumVinculado?: string;
  dataLancamento?: string;
  letra?: string;
  capaUrl?: string;
  substituir?: string;
  musicaSubstituida?: string;
  nomeAlbum?: string;
  criador?: string;
  nome?: string;
  nomeCriador?: string;
  tipoVideo?: string;
  thumbnail?: string;
  source?: 'youtube' | 'drive' | 'telegram';
  audioUrl?: string;
  videoUrl?: string;
  telegramFileId?: string;
  threadId?: string;
}

interface UploadFormProps {
  onClose?: () => void;
  userId?: string;
  userName?: string;
}

export function UploadForm({ onClose, userId = '', userName = 'Jogador' }: UploadFormProps) {
  const [step, setStep] = useState<UploadStep>('tipo');
  const [payload, setPayload] = useState<Partial<UploadPayload>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultThreadId, setResultThreadId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  function goTo(next: UploadStep, partial?: Partial<UploadPayload>) {
    if (partial) setPayload(p => ({ ...p, ...partial }));
    setError(null);
    setStep(next);
    formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(arquivoData: Partial<UploadPayload>, file?: File) {
    setIsLoading(true);
    setError(null);

    try {
      const finalPayload: Partial<UploadPayload> = { ...payload, ...arquivoData };

      if (arquivoData.source === 'telegram' && file) {
        const tgResult = await uploadToTelegram(file, finalPayload.tipo as MediaType);
        finalPayload.telegramFileId = tgResult.file_id;
        finalPayload.audioUrl = tgResult.file_url;
        finalPayload.videoUrl = tgResult.file_url;
      }

      // action como literal type exato esperado pelo submitToGAS
      const action: 'gravarMusica' | 'gravarAlbum' | 'gravarVideo' =
        finalPayload.tipo === 'album' ? 'gravarAlbum'
        : (finalPayload.tipo === 'video' || finalPayload.tipo === 'clip') ? 'gravarVideo'
        : 'gravarMusica';

      const gasBody = buildGASBody(finalPayload, userId, userName);
      const result = await submitToGAS(action, gasBody);
      setResultThreadId(result?.threadId || gasBody.threadId || null);
      goTo('sucesso');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  const steps: UploadStep[] = ['tipo', 'metadados', 'arquivo'];
  const stepIndex = steps.indexOf(step);

  return (
    <div
      className="flex flex-col"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl, 1rem)',
        maxWidth: 520,
        width: '100%',
        maxHeight: '90dvh',
        overflow: 'hidden',
      }}
    >
      {step !== 'sucesso' && (
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {step === 'tipo' ? 'O que você quer publicar?' :
               step === 'metadados' ? 'Sobre a sua publicação' :
               'Adicionar arquivo ou link'}
            </h2>
            {step !== 'tipo' && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {payload.tipo === 'music' ? '🎵 Música' :
                 payload.tipo === 'album' ? '💿 Álbum' :
                 payload.tipo === 'clip'  ? '🎬 Clipe' : '📺 Vídeo'}
              </p>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Fechar"
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--muted-foreground)', background: 'transparent' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {stepIndex > 0 && step !== 'sucesso' && (
        <div className="px-5 pt-3">
          <div className="flex gap-1.5">
            {[1, 2].map(i => (
              <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                style={{ background: i <= stepIndex ? 'var(--primary)' : 'var(--border)' }} />
            ))}
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
            Passo {stepIndex} de 2
          </p>
        </div>
      )}

      <div ref={formRef} className="flex-1 overflow-y-auto px-5 py-4">
        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg text-sm"
            style={{ background: 'oklch(from var(--destructive, #a12c7b) l c h / 0.12)', color: 'var(--destructive, #a12c7b)', border: '1px solid oklch(from var(--destructive, #a12c7b) l c h / 0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        {step === 'tipo' && <StepTipo onSelect={(tipo) => goTo('metadados', { tipo })} />}

        {step === 'metadados' && (
          <StepMetadados
            tipo={payload.tipo!}
            initial={payload}
            onBack={() => goTo('tipo')}
            onNext={(data) => goTo('arquivo', data)}
          />
        )}

        {step === 'arquivo' && (
          <StepArquivo
            tipo={payload.tipo!}
            onBack={() => goTo('metadados')}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )}

        {step === 'sucesso' && (
          <StepSucesso
            tipo={payload.tipo!}
            titulo={payload.titulo || payload.nomeAlbum || payload.nome || ''}
            threadId={resultThreadId}
            onClose={onClose}
            onNew={() => { setPayload({}); goTo('tipo'); }}
          />
        )}
      </div>
    </div>
  );
}

function buildGASBody(p: Partial<UploadPayload>, userId: string, userName: string) {
  const base = {
    threadId: p.threadId || String(Date.now()),
    idCriador: userId,
    nomeCriador: userName,
  };

  if (p.tipo === 'music') {
    return { ...base, titulo: p.titulo || '', artistas: p.artistas || [], tipoSingle: p.tipoSingle || '', tipoMusica: p.tipoMusica || 'SOLO', genero: p.genero || '', albumVinculado: p.albumVinculado || '', dataLancamento: p.dataLancamento || '', letra: p.letra || '', capaUrl: p.capaUrl || '', substituir: p.substituir || 'Não', musicaSubstituida: p.musicaSubstituida || '', source: p.source || 'drive', audioUrl: p.audioUrl || '', telegramFileId: p.telegramFileId || '' };
  }
  if (p.tipo === 'album') {
    return { ...base, titulo: p.nomeAlbum || '', criador: p.criador || userName, dataLancamento: p.dataLancamento || '', capaUrl: p.capaUrl || '', source: p.source || 'drive', videoUrl: p.videoUrl || '', telegramFileId: p.telegramFileId || '' };
  }
  return { ...base, titulo: p.nome || p.titulo || '', nomeCriador: p.nomeCriador || userName, tipoVideo: p.tipoVideo || 'Oficial', thumbnail: p.thumbnail || '', dataLancamento: p.dataLancamento || '', source: p.source || 'youtube', videoUrl: p.videoUrl || '', telegramFileId: p.telegramFileId || '' };
}
