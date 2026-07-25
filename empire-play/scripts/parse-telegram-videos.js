/**
 * parse-telegram-videos.js
 * Lê o resultvideo.json (export do Telegram) e gera:
 *   - empire-play/data/videos-parsed.json  → dados normalizados
 *   - empire-play/data/videos-parsed.csv   → pronto para importar no Google Sheets
 *
 * Como usar (Node.js):
 *   node empire-play/scripts/parse-telegram-videos.js
 */

const fs   = require('fs');
const path = require('path');

const INPUT_FILE  = path.resolve(__dirname, '../../resultvideo.json');
const OUTPUT_JSON = path.resolve(__dirname, '../data/videos-parsed.json');
const OUTPUT_CSV  = path.resolve(__dirname, '../data/videos-parsed.csv');

// --- Helpers ---

function extractDriveId(url) {
  const match = url && url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function driveToSrc(url) {
  const id = extractDriveId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
}

function parseVideoType(title) {
  if (!title) return 'video';
  const t = title.toLowerCase();
  if (t.includes('#musicvideo'))      return 'musicvideo';
  if (t.includes('#lyricvideo'))      return 'lyricvideo';
  if (t.includes('#alternativevideo')) return 'alternativevideo';
  return 'video';
}

function parseArtistTitle(topicTitle) {
  if (!topicTitle) return { artist: '', title: '' };
  let clean = topicTitle.replace(/^#\S+\s*[|]?\s*/i, '').trim();
  clean = clean.replace(/[\u275d\u275e""]/g, '"').trim();
  const dashIdx = clean.indexOf(' - ');
  if (dashIdx !== -1) {
    return { artist: clean.substring(0, dashIdx).trim(), title: clean.substring(dashIdx + 3).trim() };
  }
  return { artist: '', title: clean };
}

function formatDuration(seconds) {
  if (!seconds) return '';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (!bytes) return '';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// --- Parser ---

function findParentTopic(topics, editId) {
  const ids = Object.keys(topics).map(Number).filter(id => id < editId).sort((a, b) => b - a);
  return ids[0] || null;
}

function parseTelegramExport(data) {
  const messages = data.messages || [];
  const topics   = {};
  const videos   = [];

  for (const msg of messages) {
    if (msg.type !== 'service') continue;
    if (msg.action === 'topic_created') {
      topics[msg.id] = {
        topicId:   msg.id,
        rawTitle:  msg.title,
        videoType: parseVideoType(msg.title),
        ...parseArtistTitle(msg.title),
        createdAt: msg.date,
        createdBy: msg.actor || 'unknown',
      };
    }
    if (msg.action === 'topic_edit' && msg.new_title) {
      const parentId = findParentTopic(topics, msg.id);
      if (parentId && topics[parentId]) {
        topics[parentId].rawTitle  = msg.new_title;
        topics[parentId].videoType = parseVideoType(msg.new_title);
        const parsed = parseArtistTitle(msg.new_title);
        topics[parentId].artist = parsed.artist;
        topics[parentId].title  = parsed.title;
      }
    }
  }

  for (const msg of messages) {
    if (msg.type !== 'message') continue;
    const topic = topics[msg.reply_to_message_id];

    if (msg.media_type === 'video_file' && topic) {
      videos.push({
        id:             `tg_${msg.id}`,
        topicId:        msg.reply_to_message_id,
        videoType:      topic.videoType,
        artist:         topic.artist,
        title:          topic.title,
        rawTopicTitle:  topic.rawTitle,
        source:         'telegram',
        fileSource:     'telegram',
        fileName:       msg.file_name || '',
        fileSize:       formatSize(msg.file_size),
        duration:       formatDuration(msg.duration_seconds),
        resolution:     msg.width ? `${msg.width}x${msg.height}` : '',
        uploadedBy:     msg.from || 'unknown',
        uploadedAt:     msg.date,
        telegramMsgId:  msg.id,
        telegramFileId: '',
        playUrl:        '',
        driveUrl:       '',
        driveFileId:    '',
        youtubeId:      '',
        status:         'needs_reupload',
        notes:          'Reenviar via bot para capturar file_id permanente',
      });
      continue;
    }

    if (topic) {
      const textArr = Array.isArray(msg.text) ? msg.text : [{ text: msg.text }];
      for (const part of textArr) {
        const t = typeof part === 'string' ? part : (part.text || '');
        if (t.includes('drive.google.com')) {
          const driveId = extractDriveId(t);
          const playSrc = driveToSrc(t);
          videos.push({
            id:             `drive_${msg.id}`,
            topicId:        msg.reply_to_message_id,
            videoType:      topic.videoType,
            artist:         topic.artist,
            title:          topic.title,
            rawTopicTitle:  topic.rawTitle,
            source:         'drive',
            fileSource:     'drive',
            fileName:       '',
            fileSize:       '',
            duration:       '',
            resolution:     '',
            uploadedBy:     msg.from || 'unknown',
            uploadedAt:     msg.date,
            telegramMsgId:  msg.id,
            telegramFileId: '',
            playUrl:        playSrc || '',
            driveUrl:       t.trim(),
            driveFileId:    driveId || '',
            youtubeId:      '',
            status:         playSrc ? 'ready' : 'needs_check',
            notes:          playSrc ? 'Drive link pronto para reproducao' : 'Verificar link do Drive',
          });
          break;
        }
      }
    }
  }

  return { topics: Object.values(topics), videos };
}

// --- CSV ---

function toCSV(videos) {
  const headers = [
    'id','topicId','videoType','artist','title',
    'source','fileName','fileSize','duration','resolution',
    'uploadedBy','uploadedAt','telegramMsgId','telegramFileId',
    'playUrl','driveUrl','driveFileId','youtubeId','status','notes',
  ];
  const escape = v => {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers.join(','), ...videos.map(v => headers.map(h => escape(v[h])).join(','))].join('\n');
}

// --- Main ---

try {
  const raw  = fs.readFileSync(INPUT_FILE, 'utf-8');
  const data = JSON.parse(raw);
  const { topics, videos } = parseTelegramExport(data);

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify({ topics, videos }, null, 2), 'utf-8');
  fs.writeFileSync(OUTPUT_CSV, toCSV(videos), 'utf-8');

  console.log(`\n✅ Parse concluído!`);
  console.log(`   Tópicos  : ${topics.length}`);
  console.log(`   Vídeos   : ${videos.length}`);
  console.log(`   ready    : ${videos.filter(v => v.status === 'ready').length}`);
  console.log(`   reupload : ${videos.filter(v => v.status === 'needs_reupload').length}`);
  console.log(`\n   → ${OUTPUT_CSV}\n`);
} catch (err) {
  console.error('❌ Erro:', err.message);
  process.exit(1);
}
