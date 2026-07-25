// ============================================================
// sheetsAPI.ts
// Comunicação com o GAS Empire Hub
//
// SHEET_ID: 1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo
//
// GAS_URL deve ser definido em .env:
//   VITE_GAS_URL=https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec
// ============================================================
import type { GASConteudoItem, GASComentario, ContentType } from '../types';
import { GAS_CATEGORIA } from '../types';

const GAS_URL = import.meta.env.VITE_GAS_URL as string;

if (!GAS_URL && import.meta.env.DEV) {
  console.warn('[sheetsAPI] VITE_GAS_URL não definido. Configure em .env');
}

// ─── GET: busca conteúdo (músicas / clips / vídeos) ─────────────────────────────
export async function fetchConteudo(tipo: ContentType): Promise<GASConteudoItem[]> {
  const categoria = GAS_CATEGORIA[tipo];
  const url = `${GAS_URL}?action=conteudo&categoria=${categoria}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GAS fetchConteudo erro: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return (json.data as GASConteudoItem[]) || [];
}

// ─── GET: busca comentários de um tópico ────────────────────────────────────
export async function fetchComentarios(
  tipo: ContentType,
  idTopico: string
): Promise<GASComentario[]> {
  const categoria = GAS_CATEGORIA[tipo];
  const url = `${GAS_URL}?action=comentarios&categoria=${categoria}&idTopico=${encodeURIComponent(idTopico)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GAS fetchComentarios erro: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return (json.data as GASComentario[]) || [];
}

// ─── POST: adiciona comentário ──────────────────────────────────────────────────
export async function postComentario(params: {
  tipo: ContentType;
  idTopico: string;
  idJogador: string;
  nomeJogador: string;
  comentario: string;
}): Promise<void> {
  const categoria = GAS_CATEGORIA[params.tipo];
  const body = {
    action: 'novoComentario',
    categoria,
    idTopico:    params.idTopico,
    idJogador:   params.idJogador,
    nomeJogador: params.nomeJogador,
    comentario:  params.comentario,
  };
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GAS postComentario erro: ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'Erro ao salvar comentário');
}

// ─── POST: upload de arquivo (invisible Telegram storage) ──────────────────────
export interface UploadArquivoParams {
  file: File;
  titulo: string;
  artistas?: string;
  genero?: string;
  tipo: ContentType;
  capaUrl?: string;
  letra?: string;
  dataLancamento?: string;
}
export interface UploadResult {
  status: 'success' | 'error';
  thread_id?: string;
  file_id?: string;
  file_url?: string;
  message?: string;
}

export async function uploadArquivo(params: UploadArquivoParams): Promise<UploadResult> {
  const toBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve((r.result as string).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(f);
    });

  const fileBase64 = await toBase64(params.file);
  const body = {
    action:          'uploadArquivo',
    fileName:        params.file.name,
    mimeType:        params.file.type,
    fileBase64,
    titulo:          params.titulo,
    artistas:        params.artistas ?? '',
    genero:          params.genero ?? '',
    tipo:            params.tipo,
    capaUrl:         params.capaUrl ?? '',
    letra:           params.letra ?? '',
    dataLancamento:  params.dataLancamento ?? '',
  };
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
  return res.json() as Promise<UploadResult>;
}

// ─── POST: upload de link (YouTube / Drive) ───────────────────────────────────
export interface UploadLinkParams {
  url: string;
  titulo: string;
  artistas?: string;
  genero?: string;
  tipo: ContentType;
  capaUrl?: string;
  letra?: string;
  dataLancamento?: string;
}
export async function uploadLink(params: UploadLinkParams): Promise<UploadResult> {
  const body = { action: 'uploadLink', ...params };
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
  return res.json() as Promise<UploadResult>;
}

// ─── POST: grava conteúdo (retrocompatível) ───────────────────────────────────────
export async function submitToGAS(
  action: 'gravarMusica' | 'gravarAlbum' | 'gravarVideo',
  payload: Record<string, unknown>
): Promise<{ threadId?: string; status?: string }> {
  const body = { action, ...payload };
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GAS submitToGAS erro: ${res.status}`);
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message || 'Erro no GAS');
  return json;
}
