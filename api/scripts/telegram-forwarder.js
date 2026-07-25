const https = require('https');
const fs    = require('fs');

const BOT_TOKEN   = process.env.BOT_TOKEN;
const SOURCE_CHAT = process.env.SOURCE_CHAT_ID;
const DEST_CHAT   = process.env.DEST_CHAT_ID;
const DRY_RUN     = process.env.DRY_RUN !== 'false';

if (!BOT_TOKEN || !SOURCE_CHAT || !DEST_CHAT) {
  console.error('\u274c Vari\u00e1veis BOT_TOKEN, SOURCE_CHAT_ID e DEST_CHAT_ID s\u00e3o obrigat\u00f3rias');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync('./api/data/videos-data.json', 'utf8'))
  .filter(r => r.id_video);

function apiCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve({ ok: false, raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fmtDate(raw) {
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return raw;
  const [, Y, M, D, h, mi, s] = m;
  return `No dia ${D}/${M}/${Y} \u00e0s ${h}:${mi}:${s}`;
}

(async () => {
  console.log('\ud83c\udfa5 Empire Play - Telegram Forwarder');
  console.log(`\ud83d\udccb Total de v\u00eddeos: ${data.length}`);
  console.log(`\ud83d\udd04 Modo: ${DRY_RUN ? 'DRY RUN (sem encaminhar)' : 'PRODU\u00c7\u00c3O'}`);
  console.log('\u2500'.repeat(50));

  const log = [];
  let ok = 0, skip = 0, err = 0;

  for (const video of data) {
    const id_usuario = Array.isArray(video.id_usuario)
      ? video.id_usuario.join('')
      : String(video.id_usuario || '');

    if (video.file_source !== 'telegram') {
      console.log(`\u23ed  [SKIP] ${video.titulo_topico} (fonte: ${video.file_source || 'sem fonte'})`);
      log.push({ id_video: video.id_video, status: 'skip', reason: video.file_source || 'sem_fonte' });
      skip++;
      continue;
    }

    const topicName = video.titulo_topico.substring(0, 128);
    console.log(`\ud83d\udce4 [${video.id_video}] ${topicName}`);

    if (DRY_RUN) {
      log.push({ id_video: video.id_video, status: 'dry_run', topicName, telegram_msg_id: video.telegram_msg_id });
      ok++;
      continue;
    }

    try {
      const topicRes = await apiCall('createForumTopic', {
        chat_id: DEST_CHAT,
        name: topicName,
      });

      if (!topicRes.ok) {
        console.error(`  \u274c Erro ao criar t\u00f3pico: ${topicRes.description}`);
        log.push({ id_video: video.id_video, status: 'error', step: 'createTopic', error: topicRes.description });
        err++;
        await sleep(1000);
        continue;
      }

      const thread_id = topicRes.result.message_thread_id;

      const fwdRes = await apiCall('forwardMessage', {
        chat_id: DEST_CHAT,
        from_chat_id: SOURCE_CHAT,
        message_id: video.telegram_msg_id,
        message_thread_id: thread_id,
      });

      if (!fwdRes.ok) {
        console.error(`  \u274c Erro ao encaminhar: ${fwdRes.description}`);
        log.push({ id_video: video.id_video, status: 'error', step: 'forwardMessage', error: fwdRes.description, thread_id });
        err++;
      } else {
        const new_msg_id = fwdRes.result.message_id;
        console.log(`  \u2705 T\u00f3pico ${thread_id} | Msg encaminhada: ${new_msg_id}`);
        log.push({
          id_video: video.id_video,
          status: 'ok',
          topicName,
          thread_id,
          new_msg_id,
          id_usuario,
          nome_usuario: video.nome_usuario,
          data_criacao: fmtDate(video.data_raw),
        });
        ok++;
      }

      await sleep(300);
    } catch (e) {
      console.error(`  \u274c Exce\u00e7\u00e3o: ${e.message}`);
      log.push({ id_video: video.id_video, status: 'exception', error: e.message });
      err++;
    }
  }

  console.log('\u2500'.repeat(50));
  console.log(`\u2705 OK: ${ok} | \u23ed  Skip: ${skip} | \u274c Erros: ${err}`);
  fs.mkdirSync('./api/data', { recursive: true });
  fs.writeFileSync('./api/data/forward-log.json', JSON.stringify(log, null, 2), 'utf8');
  console.log('\ud83d\udcbe Log salvo em api/data/forward-log.json');
})();
