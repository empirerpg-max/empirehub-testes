const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./api/data/videos-data.json', 'utf8'));

function fmtDate(raw) {
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return raw;
  const [, Y, M, D, h, mi, s] = m;
  return `No dia ${D}/${M}/${Y} \u00e0s ${h}:${mi}:${s}`;
}

const headers = [
  'id_video','telegram_msg_id','tipo','titulo_topico','artista',
  'titulo_video','id_usuario','nome_usuario','data_criacao',
  'video_url','file_source','file_name','duracao_segundos','largura','altura','file_size_bytes'
];

function escCsv(v) {
  const s = (v === null || v === undefined) ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const rows = data
  .filter(r => r.id_video)
  .map(r => {
    const id_usuario = Array.isArray(r.id_usuario)
      ? r.id_usuario.join('')
      : String(r.id_usuario || '');
    return [
      r.id_video,
      r.telegram_msg_id,
      r.tipo,
      r.titulo_topico,
      r.artista,
      r.titulo_video,
      id_usuario,
      r.nome_usuario,
      fmtDate(r.data_raw),
      r.video_url,
      r.file_source,
      r.file_name || '',
      r.duracao_segundos || '',
      r.largura || '',
      r.altura || '',
      r.file_size_bytes || ''
    ].map(escCsv).join(',');
  });

const csv = [headers.join(','), ...rows].join('\n');
fs.mkdirSync('./api/data', { recursive: true });
fs.writeFileSync('./api/data/videos-export.csv', '\uFEFF' + csv, 'utf8');
console.log(`\u2705 Exportados ${rows.length} v\u00eddeos para api/data/videos-export.csv`);
