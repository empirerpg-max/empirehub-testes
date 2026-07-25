// ============================================================
// sheetsAPI.ts
// Comunicação com o GAS Empire Hub (registros2-2.txt)
//
// SHEET_ID: 1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo
//
// GAS_URL deve ser definido em .env:
//   VITE_GAS_URL=https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec
// ============================================================
import type { GASConteudoItem, GASComentario, MediaType } from '../types';
import { GAS_CATEGORIA } from '../types';

const GAS_URL = import.meta.env.VITE_GAS_URL as string;

if (!GAS_URL && import.meta.env.DEV) {
  console.warn('[sheetsAPI] VITE_GAS_URL não definido. Configure em .env');
}

// ─── GET: busca conteúdo (músicas / clips / vídeos) ─────────────────────────
export async function fetchConteudo(tipo: MediaType): Promise<GASConteudoItem[]> {
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
  tipo: MediaType,
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

// ─── POST: adiciona comentário ───────────────────────────────────────────────
export async function postComentario(params: {
  tipo: MediaType;
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

// ─── POST: grava novo conteúdo (gravarMusica / gravarAlbum / gravarVideo) ────
// O GAS ainda não tem esse handler — esta função prepara o payload
// e envia quando o doPost for atualizado (ver GAS_WRITE_GUIDE abaixo)
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

// ─── GAS_WRITE_GUIDE ─────────────────────────────────────────────────────────
// Adicione no doPost do GAS (registros2-2.txt), dentro do if-chain:
//
// if (data.action === 'gravarMusica') {
//   const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Musicas');
//   const threadId = data.threadId || String(Date.now());
//   sheet.appendRow([
//     threadId, data.titulo, data.artistas?.join(', '),
//     data.tipoSingle, data.tipoMusica, data.genero,
//     data.dataLancamento, data.capaUrl, data.audioUrl,
//     data.source, data.telegramFileId, data.letra,
//     data.idCriador, data.nomeCriador, new Date().toISOString()
//   ]);
//   return ok({ threadId });
// }
//
// if (data.action === 'gravarAlbum') { ... }
// if (data.action === 'gravarVideo') { ... }
//
// Função helper ok:
// function ok(data) {
//   return ContentService.createTextOutput(JSON.stringify({ status:'success', ...data }))
//     .setMimeType(ContentService.MimeType.JSON);
// }
