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

// Nomes reais das abas na planilha
export const SHEET_NAMES = {
  musicas:     'Musicas',
  musicVideos: 'Music Videos',
  videos:      'Videos',
  albuns:      'Albuns',
  comentariosMusicas:     'Comentarios_Musicas',
  comentariosMusicVideos: 'Comentarios_MV',
  comentariosVideos:      'Comentarios_Videos',
  top50Spotify:      'Top_50_Spotify',
  topAppleMusic:     'Top_Songs_Apple_Music',
  topVideosYT:       'Top_Videos_YT',
} as const

export type SheetRow = Record<string, string>

/**
 * Busca uma aba inteira da planilha.
 * Primeira linha = cabeçalhos. Retorna array de objetos.
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

// ── Atalhos para cada aba de conteúdo ──────────────────────────────────────
export const fetchMusicas     = () => fetchSheet(SHEET_NAMES.musicas)
export const fetchMusicVideos = () => fetchSheet(SHEET_NAMES.musicVideos)
export const fetchVideos      = () => fetchSheet(SHEET_NAMES.videos)
export const fetchAlbuns      = () => fetchSheet(SHEET_NAMES.albuns)

// ── Tipos de Chart ──────────────────────────────────────────────────────────
/**
 * Uma entrada de posição no chart.
 * Nota: `playItem` é adicionado APENAS no PlayHomePage.tsx ao cruzar com
 * os dados da planilha de músicas. NÃO pertence a este tipo base.
 */
export interface ChartEntry {
  posicao: number
  titulo: string
  capa: string
}

export interface ChartData {
  nome: string
  subtitulo: string
  icone: string
  cor: string
  capaDaPlaylist: string
  entries: ChartEntry[]
}

/**
 * Lê as três abas de charts e as converte em ChartData[].
 */
export async function fetchCharts(): Promise<ChartData[]> {
  const abas = [
    {
      sheet:     SHEET_NAMES.top50Spotify,
      nome:      'Top 50 Spotify',
      subtitulo: 'Top 50 — Spotify',
      icone:     '🎵',
      cor:       '#1DB954',
    },
    {
      sheet:     SHEET_NAMES.topAppleMusic,
      nome:      'Top Apple Music',
      subtitulo: 'Top Songs — Apple Music',
      icone:     '🍎',
      cor:       '#FC3C44',
    },
    {
      sheet:     SHEET_NAMES.topVideosYT,
      nome:      'Top Vídeos YT',
      subtitulo: 'Top Videos — YouTube',
      icone:     '▶️',
      cor:       '#FF0000',
    },
  ]

  const results = await Promise.allSettled(
    abas.map(async (aba) => {
      const rows = await fetchSheet(aba.sheet)
      const entries: ChartEntry[] = rows.map((row, idx) => {
        const posRaw = row['posicao'] ?? row['Posição'] ?? row['Posicao'] ?? String(idx + 1)
        const posicao = parseInt(posRaw, 10) || idx + 1
        const titulo  = row['titulo']  ?? row['Título']  ?? row['title'] ?? ''
        const capa    = row['capa']    ?? row['Capa']    ?? row['cover'] ?? ''
        return { posicao, titulo, capa }
      })

      const capaDaPlaylist = entries[0]?.capa ?? ''

      return {
        nome:          aba.nome,
        subtitulo:     aba.subtitulo,
        icone:         aba.icone,
        cor:           aba.cor,
        capaDaPlaylist,
        entries,
      } satisfies ChartData
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<ChartData> => r.status === 'fulfilled' && r.value.entries.length > 0)
    .map(r => r.value)
}

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
