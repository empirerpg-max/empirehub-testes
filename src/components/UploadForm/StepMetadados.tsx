// StepMetadados — Step 2: campos de metadados por tipo
import { useState } from 'react';
import type { MediaType } from '../../types';
import type { UploadPayload } from './UploadForm';

const GENEROS = ['POP', 'R&B', 'LATIN', 'ALTERNATIVE/ROCK', 'TRAP', 'FUNK', 'ELETRÔNICO', 'GOSPEL', 'MPB', 'COUNTRY', 'K-POP', 'INDIE', 'JAZZ', 'CLÁSSICO', 'OUTRO'];
const TIPOS_SINGLE = ['LEAD SINGLE', 'PRÉ-ALBUM', 'PROMOCIONAL', 'SINGLE', 'COLABORAÇÃO', 'REMIX', 'COVER', 'OUTRO'];
const TIPOS_MUSICA = ['SOLO', 'PARCERIA', 'COLABORAÇÃO', 'FEAT'];
const TIPOS_VIDEO = ['Oficial', 'Live', 'Short Film', 'Concert', 'Lyric', 'Behind the Scenes', 'Performance', 'Entrevista', 'Evento'];

interface StepMetadadosProps {
  tipo: MediaType;
  initial: Partial<UploadPayload>;
  onBack: () => void;
  onNext: (data: Partial<UploadPayload>) => void;
}

export function StepMetadados({ tipo, initial, onBack, onNext }: StepMetadadosProps) {
  const [form, setForm] = useState<Partial<UploadPayload>>(initial);
  const [artistas, setArtistas] = useState<string[]>(initial.artistas || ['']);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(key: keyof UploadPayload, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (tipo === 'music') {
      if (!form.titulo?.trim()) errs.titulo = 'Nome da música é obrigatório';
      if (!artistas[0]?.trim()) errs.artista0 = 'Artista principal é obrigatório';
      if (!form.genero) errs.genero = 'Gênero é obrigatório';
      if (!form.dataLancamento) errs.dataLancamento = 'Data de lançamento é obrigatória';
    } else if (tipo === 'album') {
      if (!form.nomeAlbum?.trim()) errs.nomeAlbum = 'Nome do álbum é obrigatório';
      if (!form.criador?.trim()) errs.criador = 'Artista é obrigatório';
      if (!form.dataLancamento) errs.dataLancamento = 'Data de lançamento é obrigatória';
    } else {
      if (!form.nome?.trim()) errs.nome = 'Título é obrigatório';
      if (!form.nomeCriador?.trim()) errs.nomeCriador = 'Criador é obrigatório';
      if (!form.tipoVideo) errs.tipoVideo = 'Tipo é obrigatório';
      if (!form.dataLancamento) errs.dataLancamento = 'Data é obrigatória';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (!validate()) return;
    onNext({ ...form, artistas: artistas.filter(a => a.trim()) });
  }

  const inputCls = "w-full px-3 py-2 rounded-lg text-sm outline-none transition-all";
  const inputStyle = {
    background: 'var(--secondary, var(--card))',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  };
  const labelCls = "block text-xs font-medium mb-1";
  const labelStyle = { color: 'var(--muted-foreground)' };
  const errStyle = { color: 'var(--destructive, #a12c7b)', fontSize: '0.7rem', marginTop: 2 };

  return (
    <div className="flex flex-col gap-4">
      {/* ── MÚSICA ─────────────────────────────────── */}
      {tipo === 'music' && (
        <>
          <Field label="Nome da música *" error={errors.titulo}>
            <input className={inputCls} style={inputStyle} placeholder="ex: Cotton Candy Girl"
              value={form.titulo || ''} onChange={e => set('titulo', e.target.value)} />
          </Field>

          <div>
            <label className={labelCls} style={labelStyle}>Artista(s) *</label>
            {artistas.map((a, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input className={inputCls} style={{ ...inputStyle, flex: 1 }}
                  placeholder={i === 0 ? 'Artista principal' : `Feat. ${i}`}
                  value={a}
                  onChange={e => { const n = [...artistas]; n[i] = e.target.value; setArtistas(n); }}
                />
                {i > 0 && (
                  <button onClick={() => setArtistas(artistas.filter((_, j) => j !== i))}
                    className="px-2 rounded-lg" style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)' }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {errors.artista0 && <p style={errStyle}>{errors.artista0}</p>}
            {artistas.length < 6 && (
              <button onClick={() => setArtistas([...artistas, ''])}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--primary)', background: 'oklch(from var(--primary) l c h / 0.1)' }}>
                + Adicionar feat.
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Gênero *" error={errors.genero}>
              <select className={inputCls} style={inputStyle} value={form.genero || ''}
                onChange={e => set('genero', e.target.value)}>
                <option value="">Selecionar</option>
                {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Tipo de single" error={errors.tipoSingle}>
              <select className={inputCls} style={inputStyle} value={form.tipoSingle || ''}
                onChange={e => set('tipoSingle', e.target.value)}>
                <option value="">Selecionar</option>
                {TIPOS_SINGLE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de música">
              <select className={inputCls} style={inputStyle} value={form.tipoMusica || 'SOLO'}
                onChange={e => set('tipoMusica', e.target.value)}>
                {TIPOS_MUSICA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Data de lançamento *" error={errors.dataLancamento}>
              <input type="date" className={inputCls} style={inputStyle}
                value={form.dataLancamento || ''} onChange={e => set('dataLancamento', e.target.value)} />
            </Field>
          </div>

          <Field label="URL da capa (Google Drive)">
            <input className={inputCls} style={inputStyle} placeholder="https://drive.google.com/..."
              value={form.capaUrl || ''} onChange={e => set('capaUrl', e.target.value)} />
          </Field>

          <Field label="Letra (opcional)">
            <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              placeholder="Cole aqui a letra da música..."
              value={form.letra || ''} onChange={e => set('letra', e.target.value)} />
          </Field>
        </>
      )}

      {/* ── ÁLBUM ──────────────────────────────────── */}
      {tipo === 'album' && (
        <>
          <Field label="Nome do álbum *" error={errors.nomeAlbum}>
            <input className={inputCls} style={inputStyle} placeholder="ex: Rayna - WASTELAND."
              value={form.nomeAlbum || ''} onChange={e => set('nomeAlbum', e.target.value)} />
          </Field>
          <Field label="Artista *" error={errors.criador}>
            <input className={inputCls} style={inputStyle} placeholder="Nome do artista"
              value={form.criador || ''} onChange={e => set('criador', e.target.value)} />
          </Field>
          <Field label="Data de lançamento *" error={errors.dataLancamento}>
            <input type="date" className={inputCls} style={inputStyle}
              value={form.dataLancamento || ''} onChange={e => set('dataLancamento', e.target.value)} />
          </Field>
          <Field label="URL da capa (Google Drive)">
            <input className={inputCls} style={inputStyle} placeholder="https://drive.google.com/..."
              value={form.capaUrl || ''} onChange={e => set('capaUrl', e.target.value)} />
          </Field>
        </>
      )}

      {/* ── CLIPE / VÍDEO ─────────────────────────── */}
      {(tipo === 'clip' || tipo === 'video') && (
        <>
          <Field label={tipo === 'clip' ? 'Título do clipe *' : 'Título do vídeo *'} error={errors.nome}>
            <input className={inputCls} style={inputStyle}
              placeholder={tipo === 'clip' ? 'ex: Rayna - Cotton Candy Girl' : 'ex: SA5M - Super Bowl Halftime Show'}
              value={form.nome || ''} onChange={e => set('nome', e.target.value)} />
          </Field>
          <Field label="Criador *" error={errors.nomeCriador}>
            <input className={inputCls} style={inputStyle} placeholder="Nome do criador"
              value={form.nomeCriador || ''} onChange={e => set('nomeCriador', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo *" error={errors.tipoVideo}>
              <select className={inputCls} style={inputStyle} value={form.tipoVideo || ''}
                onChange={e => set('tipoVideo', e.target.value)}>
                <option value="">Selecionar</option>
                {TIPOS_VIDEO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Data *" error={errors.dataLancamento}>
              <input type="date" className={inputCls} style={inputStyle}
                value={form.dataLancamento || ''} onChange={e => set('dataLancamento', e.target.value)} />
            </Field>
          </div>
          <Field label="URL da thumbnail (opcional)">
            <input className={inputCls} style={inputStyle} placeholder="https://drive.google.com/..."
              value={form.thumbnail || ''} onChange={e => set('thumbnail', e.target.value)} />
          </Field>
        </>
      )}

      {/* Botões */}
      <div className="flex gap-3 pt-2">
        <button onClick={onBack}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
          ← Voltar
        </button>
        <button onClick={handleNext}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--primary)', color: 'white' }}>
          Próximo →
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {children}
      {error && <p style={{ color: 'var(--destructive, #a12c7b)', fontSize: '0.7rem', marginTop: 2 }}>{error}</p>}
    </div>
  );
}
