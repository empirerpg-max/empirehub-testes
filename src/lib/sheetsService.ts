/**
 * sheetsService.ts
 * Lê as abas da planilha Empire Play via Google Sheets API v4 (chave pública).
 * Spreadsheet: 1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo
 *
 * Variáveis de ambiente necessárias (Vite):
 *   VITE_SHEETS_API_KEY          — chave da Google Cloud (Sheets API v4)
 *   VITE_GAS_URL (opcional)      — Apps Script Web App para escrita
 */

const API_KEY = import.meta.env.VITE_SHEETS_API_KEY as string | undefined
const SPREADSHEET_ID = '1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo'
const GAS_URL = import.meta.env.VITE_GAS_URL as string | undefined

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`

// Nomes reais das abas na planilha (confirmados no EmpirePlay.gs)
export const SHEET_NAMES = {
  musicas:     'Musicas',
  musicVideos: 'Music Videos',
  videos:      'Videos',
  albuns:      'Albuns',
  comentariosMusicas:     'Comentarios_Musicas',
  comentariosMusicVideos: 'Comentarios_MV',
  comentariosVideos:      'Comentarios_Videos',
} as const

export type SheetRow = Record<string, string>

/**
 * Busca uma aba inteira da planilha.
 * Primeira linha = cabeçalhos. Retorna array de objetos.
 * Se API_KEY não estiver configurada, retorna array vazio (sem crash).
 */
export async function fetchSheet(sheetName: string): Promise<SheetRow[]> {
  if (!API_KEY) {
    console.warn(`[SheetsService] VITE_SHEETS_API_KEY não definida — usando dados mock para "${sheetName}".`)
    return []
  }

  const url = `${BASE}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}&valueRenderOption=FORMATTED_VALUE`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[SheetsService] Erro HTTP ${res.status} ao buscar "${sheetName}"`)
      return []
    }
    const json = (await res.json()) as { values?: string[][] }
    if (!json.values || json.values.length < 2) return []
    const [headers, ...rows] = json.values
    return rows
      .filter(row => row.some(cell => cell !== ''))
      .map(row =>
        Object.fromEntries(
          headers.map((h, i) => [h.trim(), (row[i] ?? '').trim()])
        ) as SheetRow
      )
  } catch (err) {
    console.error(`[SheetsService] Falha ao buscar "${sheetName}":`, err)
    return []
  }
}

// Atalhos para cada aba
export const fetchMusicas     = () => fetchSheet(SHEET_NAMES.musicas)
export const fetchMusicVideos = () => fetchSheet(SHEET_NAMES.musicVideos)
export const fetchVideos      = () => fetchSheet(SHEET_NAMES.videos)
export const fetchAlbuns      = () => fetchSheet(SHEET_NAMES.albuns)

export const fetchComentarios = (categoria: 'musicas' | 'musicVideos' | 'videos', idTopico?: string) => {
  const map = {
    musicas:     SHEET_NAMES.comentariosMusicas,
    musicVideos: SHEET_NAMES.comentariosMusicVideos,
    videos:      SHEET_NAMES.comentariosVideos,
  }
  return fetchSheet(map[categoria]).then(rows =>
    idTopico ? rows.filter(r => String(r['id_do_topico'] ?? '') === String(idTopico)) : rows
  )
}

/**
 * Envia um comentário via Apps Script Web App.
 * Requer VITE_GAS_URL.
 */
export async function postComentario(payload: {
  action: 'novoComentario'
  categoria: 'musicas' | 'musicvideos' | 'videos'
  idTopico: string
  idJogador?: string
  nomeJogador?: string
  comentario: string
}): Promise<{ status: string }> {
  if (!GAS_URL) throw new Error('[SheetsService] VITE_GAS_URL não definida.')
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}
