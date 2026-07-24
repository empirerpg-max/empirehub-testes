/**
 * empire-telegram-api / server.js
 *
 * API intermediária entre o Empire Play e o Telegram Bot API.
 * O front NUNCA fala diretamente com o Telegram.
 *
 * Endpoints:
 *   POST /upload            — upload de arquivo → Telegram → salva no catálogo
 *   POST /catalog           — registra mídia YT ou Drive (sem upload)
 *   GET  /catalog           — lista o catálogo completo
 *   GET  /play/:fileId      — resolve getFile e faz pipe do stream (com Range)
 *   DELETE /catalog/:fileId — remove do catálogo (não apaga do Telegram)
 *   GET  /health            — healthcheck
 *
 * Para arquivos > 20 MB, use o Local Bot API Server com --local.
 * Veja a seção "Local Bot API" no README.
 */

require('dotenv').config({ path: '../.env' })

const express  = require('express')
const cors     = require('cors')
const multer   = require('multer')
const fetch    = require('node-fetch')
const FormData = require('form-data')
const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')

// ── Config ──────────────────────────────────────────────────────────────────

const PORT    = process.env.PORT || 3001
const TOKEN   = process.env.BOT_TOKEN
const CHAT_ID = process.env.CHAT_ID

// Para usar o Local Bot API Server (--local), defina TELEGRAM_API_ROOT no .env
// Ex: TELEGRAM_API_ROOT=http://localhost:8081/bot
const TG_ROOT = (process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org/bot').replace(/\/$/, '')
const TG_FILE = TG_ROOT.replace('/bot', '/file/bot')

if (!TOKEN || !CHAT_ID) {
  console.error('[empire-api] ERRO: BOT_TOKEN e CHAT_ID são obrigatórios no .env')
  process.exit(1)
}

// ── Banco de dados (SQLite local) ───────────────────────────────────────────

const db = new Database(path.join(__dirname, 'catalog.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS catalog (
    file_id    TEXT PRIMARY KEY,
    message_id INTEGER,
    chat_id    TEXT,
    source     TEXT NOT NULL DEFAULT 'telegram',
    mime_type  TEXT,
    file_size  INTEGER DEFAULT 0,
    duration   INTEGER DEFAULT 0,
    titulo     TEXT,
    artista    TEXT,
    capa       TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )
`)

const insertMedia = db.prepare(`
  INSERT OR REPLACE INTO catalog
    (file_id, message_id, chat_id, source, mime_type, file_size, duration, titulo, artista, capa)
  VALUES
    (@file_id, @message_id, @chat_id, @source, @mime_type, @file_size, @duration, @titulo, @artista, @capa)
`)

const listAll    = db.prepare('SELECT * FROM catalog ORDER BY created_at DESC')
const deleteById = db.prepare('DELETE FROM catalog WHERE file_id = ?')

// ── App ─────────────────────────────────────────────────────────────────────

const app    = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2000 * 1024 * 1024 } })

app.use(cors())
app.use(express.json())

// ── Helpers ─────────────────────────────────────────────────────────────────

async function tgCall(method, body) {
  const url = `${TG_ROOT}${TOKEN}/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`Telegram ${method} falhou: ${json.description}`)
  return json.result
}

async function tgUploadFile(buffer, filename, mimeType, meta) {
  const form = new FormData()
  form.append('chat_id', CHAT_ID)

  const isAudio = mimeType?.startsWith('audio/')
  const isVideo = mimeType?.startsWith('video/')
  const method  = isAudio ? 'sendAudio' : isVideo ? 'sendVideo' : 'sendDocument'
  const field   = isAudio ? 'audio'     : isVideo ? 'video'     : 'document'

  form.append(field, buffer, { filename, contentType: mimeType })

  if (isAudio) {
    if (meta?.titulo)  form.append('title',     meta.titulo)
    if (meta?.artista) form.append('performer', meta.artista)
  }

  const url = `${TG_ROOT}${TOKEN}/${method}`
  const res = await fetch(url, { method: 'POST', body: form })
  const json = await res.json()
  if (!json.ok) throw new Error(`Telegram ${method} falhou: ${json.description}`)
  return json.result
}

/**
 * Parseia o header Range e retorna { start, end } ou null.
 * Ex: "bytes=0-1023" → { start: 0, end: 1023 }
 */
function parseRange(rangeHeader, totalSize) {
  if (!rangeHeader) return null
  const m = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  if (!m) return null
  const start = parseInt(m[1], 10)
  const end   = m[2] ? parseInt(m[2], 10) : totalSize - 1
  if (isNaN(start) || start >= totalSize) return null
  return { start, end: Math.min(end, totalSize - 1) }
}

// ── Rotas ────────────────────────────────────────────────────────────────────

/** GET /health */
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

/**
 * POST /upload
 * Body: multipart/form-data
 *   file — arquivo de áudio ou vídeo
 *   meta — JSON string com { titulo, artista, capa }
 */
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' })

    const meta     = JSON.parse(req.body?.meta || '{}')
    const { buffer, originalname, mimetype, size } = req.file

    const result   = await tgUploadFile(buffer, originalname, mimetype, meta)

    const media    = result.audio || result.video || result.document || {}
    const file_id  = media.file_id  || ''
    const duration = media.duration || 0

    const row = {
      file_id,
      message_id: result.message_id,
      chat_id:    String(CHAT_ID),
      source:     'telegram',
      mime_type:  mimetype,
      file_size:  size,
      duration,
      titulo:     meta.titulo  || originalname,
      artista:    meta.artista || '',
      capa:       meta.capa    || '',
    }

    insertMedia.run(row)
    res.json(row)
  } catch (err) {
    console.error('[/upload]', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /catalog
 * Registra mídia de YouTube ou Drive sem fazer upload.
 * Body JSON: { file_id, source, titulo, artista, capa, mime_type }
 *   source: 'youtube' | 'drive'
 */
app.post('/catalog', async (req, res) => {
  try {
    const { file_id, source, titulo, artista, capa, mime_type } = req.body
    if (!file_id || !source) return res.status(400).json({ error: 'file_id e source são obrigatórios' })

    const row = {
      file_id,
      message_id: 0,
      chat_id:    '',
      source,
      mime_type:  mime_type || '',
      file_size:  0,
      duration:   0,
      titulo:     titulo  || '',
      artista:    artista || '',
      capa:       capa    || '',
    }

    insertMedia.run(row)
    res.json(row)
  } catch (err) {
    console.error('[/catalog POST]', err)
    res.status(500).json({ error: err.message })
  }
})

/** GET /catalog */
app.get('/catalog', (_req, res) => {
  try {
    res.json(listAll.all())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /play/:fileId
 *
 * Resolve getFile no Bot API e faz pipe do stream para o cliente.
 * Suporta Range requests (obrigatório para Safari e seeking no <audio>/<video>).
 *
 * Modos de operação:
 *
 *   1. Local Bot API Server (--local)
 *      file_path retorna caminho absoluto no disco.
 *      Usamos fs.createReadStream com range manual — suporte completo a seeking.
 *      Sem limite de tamanho.
 *
 *   2. Bot API cloud
 *      file_path é um path relativo. Montamos a URL temporária (válida 1h).
 *      Download máximo: 20 MB. Range: fazemos pipe com header Range repassado.
 *      Para arquivos maiores, migrate para Local Bot API Server.
 */
app.get('/play/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params
    const rangeHeader = req.headers['range']

    const fileInfo = await tgCall('getFile', { file_id: fileId })
    const filePath = fileInfo.file_path
    const fileSize = fileInfo.file_size || 0

    // ── Modo 1: Local Bot API — caminho absoluto no disco ────────────────────
    if (filePath && path.isAbsolute(filePath)) {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado no disco' })
      }

      const stat = fs.statSync(filePath)
      const total = stat.size
      const mimeType = lookupMime(filePath)

      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Type', mimeType)

      const range = parseRange(rangeHeader, total)
      if (range) {
        const { start, end } = range
        res.status(206)
        res.setHeader('Content-Range',  `bytes ${start}-${end}/${total}`)
        res.setHeader('Content-Length', end - start + 1)
        fs.createReadStream(filePath, { start, end }).pipe(res)
      } else {
        res.setHeader('Content-Length', total)
        fs.createReadStream(filePath).pipe(res)
      }
      return
    }

    // ── Modo 2: Bot API cloud — URL temporária ───────────────────────────────
    const fileUrl = `${TG_FILE}${TOKEN}/${filePath}`

    const headers = {}
    if (rangeHeader) headers['Range'] = rangeHeader

    const upstream = await fetch(fileUrl, { headers })

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).json({ error: `Falha ao buscar arquivo no Telegram: HTTP ${upstream.status}` })
    }

    const contentType   = upstream.headers.get('content-type')   || 'application/octet-stream'
    const contentLength = upstream.headers.get('content-length')
    const contentRange  = upstream.headers.get('content-range')

    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'no-store')
    if (contentLength) res.setHeader('Content-Length', contentLength)
    if (contentRange)  res.setHeader('Content-Range',  contentRange)

    res.status(rangeHeader ? 206 : 200)
    upstream.body.pipe(res)
  } catch (err) {
    console.error('[/play]', err)
    res.status(500).json({ error: err.message })
  }
})

/** DELETE /catalog/:fileId */
app.delete('/catalog/:fileId', (req, res) => {
  try {
    deleteById.run(req.params.fileId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── MIME helper simples (sem dependência extra) ──────────────────────────────

function lookupMime(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
  }
  return map[ext] || 'application/octet-stream'
}

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[empire-api] rodando em http://localhost:${PORT}`)
  console.log(`[empire-api] Telegram API root: ${TG_ROOT}`)
  console.log(`[empire-api] Chat ID de storage: ${CHAT_ID}`)
})
