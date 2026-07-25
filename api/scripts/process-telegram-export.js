#!/usr/bin/env node
// Processa o export do Telegram (resultvideo-12.json) e gera:
// 1. api/data/videos-data.json  (base de dados estruturada)
// 2. api/data/videos-export.csv (planilha com IDs corretos)

const fs = require('fs');

const INPUT = process.argv[2] || './resultvideo-12.json';
if (!fs.existsSync(INPUT)) {
  console.error(`\u274c Arquivo n\u00e3o encontrado: ${INPUT}`);
  console.error('   Fa\u00e7a upload do export do Telegram como resultvideo-12.json na raiz do reposit\u00f3rio.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const messages = raw.messages || [];

function parseTitulo(title) {
  const parts = title.split('|').map(s => s.trim());
  if (parts.length >= 3) {
    const rawTipo = parts[0].replace(/^#/, '').toLowerCase().replace(/\s+/g, '');
    const tipoMap = { musicvideo: 'musicvideo', mv: 'musicvideo', video: 'video',
                      live: 'video', lyricvideo: 'musicvideo', short: 'video' };
    const tipo = tipoMap[rawTipo] || 'video';
    const artista = parts[1].replace(/^(video|music video|live|lyric video|short)\s*[-|]\s*/i, '').trim();
    const titulo = parts[2];
    return { tipo, artista, titulo };
  }
  if (parts.length === 2) {
    return { tipo: 'video', artista: parts[0].replace(/^#\w+\s*/, ''), titulo: parts[1] };
  }
  return { tipo: 'video', artista: '', titulo: title };
}

function extractLink(text) {
  if (!text) return '';
  const s = Array.isArray(text)
    ? text.map(p => typeof p === 'string' ? p : (p.text || '')).join(' ')
    : String(text);
  const m = s.match(/https?:\/\/\S+/);
  return m ? m[0] : '';
}

function detectSource(url) {
  if (url.includes('drive.google.com')) return 'drive';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'other';
}

function driveEmbed(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
}

function ytEmbed(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : url;
}

function fmtDate(raw) {
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return raw;
  const [, Y, M, D, h, mi, s] = m;
  return `No dia ${D}/${M}/${Y} \u00e0s ${h}:${mi}:${s}`;
}

function cleanUserId(actorId) {
  return String(actorId || '').replace(/^(user|channel)/, '').replace(/[^0-9]/g, '');
}

// Construir topicos
const topics = {};

for (const msg of messages) {
  if (msg.type !== 'service') continue;
  const { action, id: mid } = msg;

  if (action === 'topic_created') {
    const parsed = parseTitulo(msg.title || '');
    topics[mid] = {
      id_video: mid,
      telegram_msg_id: mid,
      tipo: parsed.tipo,
      titulo_topico: msg.title || '',
      artista: parsed.artista,
      titulo_video: parsed.titulo,
      id_usuario: cleanUserId(msg.actor_id),
      nome_usuario: msg.actor || '',
      data_raw: msg.date || '',
      video_url: '',
      file_source: '',
      file_name: '',
      duracao_segundos: null,
      largura: null,
      altura: null,
      file_size_bytes: null,
    };
  } else if (action === 'topic_edit' && msg.new_title) {
    const parsed = parseTitulo(msg.new_title);
    const tids = Object.keys(topics).map(Number).sort((a, b) => b - a);
    for (const tid of tids) {
      if (tid < mid) {
        Object.assign(topics[tid], {
          titulo_topico: msg.new_title,
          tipo: parsed.tipo,
          artista: parsed.artista,
          titulo_video: parsed.titulo,
        });
        break;
      }
    }
  }
}

// Mapear midias
for (const msg of messages) {
  if (msg.type !== 'message') continue;
  const rt = msg.reply_to_message_id;
  if (!topics[rt]) continue;
  const t = topics[rt];
  if (t.video_url) continue;

  if (msg.media_type === 'video_file') {
    Object.assign(t, {
      file_name: msg.file_name || '',
      duracao_segundos: msg.duration_seconds ?? null,
      largura: msg.width ?? null,
      altura: msg.height ?? null,
      file_size_bytes: msg.file_size ?? null,
      file_source: 'telegram',
      telegram_msg_id: msg.id,
      video_url: `telegram://msg/${msg.id}`,
    });
  } else {
    const link = extractLink(msg.text);
    if (link) {
      const src = detectSource(link);
      t.file_source = src;
      t.video_url = src === 'drive' ? driveEmbed(link) : src === 'youtube' ? ytEmbed(link) : link;
      t.telegram_msg_id = msg.id;
    }
  }
}

const rows = Object.values(topics).sort((a, b) => a.id_video - b.id_video);

// Escrever videos-data.json
fs.mkdirSync('./api/data', { recursive: true });
fs.writeFileSync('./api/data/videos-data.json', JSON.stringify(rows, null, 2), 'utf8');
console.log(`\u2705 videos-data.json gerado com ${rows.length} v\u00eddeos`);

// Escrever videos-export.csv
const headers = [
  'id_video', 'telegram_msg_id', 'tipo', 'titulo_topico', 'artista', 'titulo_video',
  'id_usuario', 'nome_usuario', 'data_criacao', 'video_url', 'file_source',
  'file_name', 'duracao_segundos', 'largura', 'altura', 'file_size_bytes'
];

function esc(v) {
  const s = (v === null || v === undefined) ? '' : String(v);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

const csvRows = rows.map(r => [
  r.id_video, r.telegram_msg_id, r.tipo, r.titulo_topico, r.artista, r.titulo_video,
  r.id_usuario, r.nome_usuario, fmtDate(r.data_raw), r.video_url, r.file_source,
  r.file_name, r.duracao_segundos ?? '', r.largura ?? '', r.altura ?? '', r.file_size_bytes ?? ''
].map(esc).join(','));

const csv = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
fs.writeFileSync('./api/data/videos-export.csv', csv, 'utf8');
console.log(`\u2705 videos-export.csv gerado com ${rows.length} linhas`);

const counter = rows.reduce((acc, r) => {
  const k = r.file_source || 'sem_fonte';
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
console.log('\ud83d\udcca Fontes:', JSON.stringify(counter));
