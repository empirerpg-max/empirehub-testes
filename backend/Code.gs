// =============================================================================
// Code.gs — Empire Hub · Backend Unificado
// Mescla: registros1.txt (Telegram + Charts) + registros2.txt (Empire Play)
//
// Secrets obrigatórios (Configurações → Propriedades do Script):
//   TG_BOT_TOKEN   — token do bot (@BotFather)
//   TG_CHANNEL_ID  — ID numérico do canal de storage (ex: -1001234567890)
//   CHARTS_SHEET_ID — ID da planilha de Charts
//
// Planilha principal (Empire Play):
//   ID: 1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo
// =============================================================================

const EMPIRE_SHEET_ID = '1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo';

// Mapa de abas da planilha Empire Play
const ABA = {
  musicas:              'Musicas',
  comentarios_musicas:  'Comentarios_Musicas',
  musicvideos:          'Music Videos',
  comentarios_mv:       'Comentarios_MV',
  videos:               'Videos',
  comentarios_videos:   'Comentarios_Videos',
  albuns:               'Albuns',
  comentarios_albuns:   'Comentarios_Albuns',
  top50spotify:         'Top_50_Spotify',
  topapple:             'Top_Songs_Apple_Music',
  topyt:                'Top_Videos_YT',
};

// Mapa: categoria recebida no POST → aba de comentários
const ABA_COMENTARIOS = {
  musicas:     ABA.comentarios_musicas,
  musicvideos: ABA.comentarios_mv,
  videos:      ABA.comentarios_videos,
  albuns:      ABA.comentarios_albuns,
};

// =============================================================================
// CORS helper
// =============================================================================
function buildResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// doGet — Leitura de dados
// =============================================================================
// Parâmetros:
//   ?action=conteudo&categoria=musicas
//   ?action=comentarios&categoria=musicas&idTopico=XYZ
//   ?action=charts
//   ?action=topcharts&tipo=spotify|apple|youtube
// =============================================================================
function doGet(e) {
  try {
    const p        = e.parameter || {};
    const action   = p.action || 'conteudo';
    const ss       = SpreadsheetApp.openById(EMPIRE_SHEET_ID);

    // ── Conteúdo (músicas / clips / vídeos / álbuns) ────────────────────
    if (action === 'conteudo') {
      const cat  = (p.categoria || 'musicas').toLowerCase();
      const nome = ABA[cat] || ABA.musicas;
      const data = lerAba_(ss, nome);
      return buildResponse_({ status: 'success', data });
    }

    // ── Comentários ─────────────────────────────────────────────────────
    if (action === 'comentarios') {
      const cat      = (p.categoria || 'musicas').toLowerCase();
      const idTopico = p.idTopico || '';
      const nomeAba  = ABA_COMENTARIOS[cat] || ABA.comentarios_musicas;
      const todos    = lerAba_(ss, nomeAba);
      const filtrado = idTopico
        ? todos.filter(r => String(r['id_topico'] || r['idTopico'] || '') === idTopico)
        : todos;
      return buildResponse_({ status: 'success', data: filtrado });
    }

    // ── Charts ──────────────────────────────────────────────────────────
    if (action === 'charts') {
      const chartsId = PropertiesService.getScriptProperties().getProperty('CHARTS_SHEET_ID');
      if (!chartsId) return buildResponse_({ status: 'error', message: 'CHARTS_SHEET_ID não configurado' });
      const ssCharts = SpreadsheetApp.openById(chartsId);
      const sheets   = ssCharts.getSheets();
      const resultado = {};
      sheets.forEach(sh => {
        resultado[sh.getName()] = lerAba_(ssCharts, sh.getName());
      });
      return buildResponse_({ status: 'success', data: resultado });
    }

    // ── Top charts ──────────────────────────────────────────────────────
    if (action === 'topcharts') {
      const tipo = (p.tipo || 'spotify').toLowerCase();
      const mapaTop = { spotify: ABA.top50spotify, apple: ABA.topapple, youtube: ABA.topyt };
      const data = lerAba_(ss, mapaTop[tipo] || ABA.top50spotify);
      return buildResponse_({ status: 'success', data });
    }

    return buildResponse_({ status: 'error', message: 'action inválida: ' + action });
  } catch (err) {
    return buildResponse_({ status: 'error', message: err.message });
  }
}

// =============================================================================
// doPost — Escrita de dados
// =============================================================================
// actions:
//   uploadArquivo  — base64 → Telegram → URL .mp4 → duplo registro
//   uploadLink     — link YouTube/Drive → notifica canal + duplo registro
//   novoComentario — salva comentário na aba correta
//   gravarMusica   — retrocompat
//   gravarVideo    — retrocompat
// =============================================================================
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || '';

    if (action === 'uploadArquivo')  return handleUploadArquivo_(body);
    if (action === 'uploadLink')     return handleUploadLink_(body);
    if (action === 'novoComentario') return handleNovoComentario_(body);
    if (action === 'gravarMusica')   return handleGravarConteudo_(body, ABA.musicas);
    if (action === 'gravarVideo')    return handleGravarConteudo_(body, ABA.videos);

    return buildResponse_({ status: 'error', message: 'action inválida: ' + action });
  } catch (err) {
    return buildResponse_({ status: 'error', message: err.message });
  }
}

// =============================================================================
// HANDLERS
// =============================================================================

// ── uploadArquivo ─────────────────────────────────────────────────────────────
function handleUploadArquivo_(body) {
  const { fileName, mimeType, fileBase64, titulo, artistas, genero,
          tipo, capaUrl, letra, dataLancamento } = body;

  if (!fileBase64) return buildResponse_({ status: 'error', message: 'fileBase64 ausente' });

  // 1. Converte base64 em Blob e envia ao Telegram
  const bytes    = Utilities.base64Decode(fileBase64);
  const blob     = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', fileName || 'arquivo');
  const tgResult = apiTelegram_(blob, mimeType, titulo || fileName);

  if (!tgResult.ok) {
    return buildResponse_({ status: 'error', message: 'Telegram recusou o arquivo: ' + JSON.stringify(tgResult) });
  }

  // 2. Extrai file_id e converte em URL direta
  const msg    = tgResult.result;
  const fileId = extrairFileId_(msg);
  const fileUrl = fileId ? getFilePath_(fileId) : '';

  // 3. Gera ID de tópico
  const threadId = 'TPC_' + Utilities.getUuid().substring(0, 8).toUpperCase();
  const now      = new Date().toISOString();

  // 4. Duplo registro
  const abaConteudo = resolverAbaPorTipo_(tipo);
  const rowEmpire = [
    threadId, titulo, artistas, genero, tipo,
    capaUrl, fileUrl, fileId, letra, dataLancamento, now, 'telegram'
  ];
  appendToAba_(SpreadsheetApp.openById(EMPIRE_SHEET_ID), abaConteudo, rowEmpire);
  gravarRegistroFinal_(threadId, titulo, artistas, genero, tipo, fileUrl, capaUrl, now);

  return buildResponse_({
    status: 'success',
    thread_id: threadId,
    file_id:   fileId,
    file_url:  fileUrl,
  });
}

// ── uploadLink ────────────────────────────────────────────────────────────────
function handleUploadLink_(body) {
  const { url, titulo, artistas, genero, tipo, capaUrl, letra, dataLancamento } = body;

  if (!url) return buildResponse_({ status: 'error', message: 'url ausente' });

  // Notifica o canal de storage via Telegram (texto silencioso)
  apiTelegramMensagem_(`🔗 *${titulo || url}*\n${artistas ? 'Artista: ' + artistas + '\n' : ''}Tipo: ${tipo || '?'}\n\`${url}\``);

  const threadId = 'TPC_' + Utilities.getUuid().substring(0, 8).toUpperCase();
  const now      = new Date().toISOString();

  const abaConteudo = resolverAbaPorTipo_(tipo);
  const rowEmpire = [
    threadId, titulo, artistas, genero, tipo,
    capaUrl, url, '', letra, dataLancamento, now, 'link'
  ];
  appendToAba_(SpreadsheetApp.openById(EMPIRE_SHEET_ID), abaConteudo, rowEmpire);
  gravarRegistroFinal_(threadId, titulo, artistas, genero, tipo, url, capaUrl, now);

  return buildResponse_({
    status: 'success',
    thread_id: threadId,
    file_url:  url,
  });
}

// ── novoComentario ────────────────────────────────────────────────────────────
function handleNovoComentario_(body) {
  const { categoria, idTopico, idJogador, nomeJogador, comentario } = body;
  if (!comentario) return buildResponse_({ status: 'error', message: 'comentario ausente' });

  const cat    = (categoria || 'musicas').toLowerCase();
  const nomeAba = ABA_COMENTARIOS[cat] || ABA.comentarios_musicas;
  const idComentario = 'CMT_' + Utilities.getUuid().substring(0, 8).toUpperCase();
  const now = new Date().toISOString();

  appendToAba_(SpreadsheetApp.openById(EMPIRE_SHEET_ID), nomeAba, [
    idComentario, idTopico, idJogador, nomeJogador, comentario, now
  ]);

  return buildResponse_({ status: 'success', id_comentario: idComentario });
}

// ── gravarConteudo (retrocompat) ──────────────────────────────────────────────
function handleGravarConteudo_(body, abaAlvo) {
  const { titulo, artistas, genero, tipo, audioSrc, capaUrl, letra, dataLancamento } = body;
  const threadId = body.threadId || 'TPC_' + Utilities.getUuid().substring(0, 8).toUpperCase();
  const now = new Date().toISOString();

  appendToAba_(SpreadsheetApp.openById(EMPIRE_SHEET_ID), abaAlvo, [
    threadId, titulo, artistas, genero, tipo,
    capaUrl, audioSrc, '', letra, dataLancamento, now, 'manual'
  ]);

  return buildResponse_({ status: 'success', threadId });
}

// =============================================================================
// TELEGRAM HELPERS
// =============================================================================

// Envia arquivo (áudio, vídeo, documento) para o canal de storage
function apiTelegram_(blob, mimeType, caption) {
  const props  = PropertiesService.getScriptProperties();
  const token  = props.getProperty('TG_BOT_TOKEN');
  const chatId = props.getProperty('TG_CHANNEL_ID');
  if (!token || !chatId) throw new Error('TG_BOT_TOKEN ou TG_CHANNEL_ID não configurados');

  // Escolhe método pelo mime
  let method = 'sendDocument';
  if (mimeType && mimeType.startsWith('audio/')) method = 'sendAudio';
  if (mimeType && mimeType.startsWith('video/')) method = 'sendVideo';

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const payload = {
    chat_id:              chatId,
    caption:              caption || '',
    disable_notification: true,
  };

  // Define o campo correto de arquivo por método
  const fieldName = method === 'sendAudio' ? 'audio' : method === 'sendVideo' ? 'video' : 'document';
  payload[fieldName] = blob;

  const options = { method: 'post', payload, muteHttpExceptions: true };
  const res  = UrlFetchApp.fetch(url, options);
  return JSON.parse(res.getContentText());
}

// Envia mensagem de texto silenciosa para o canal
function apiTelegramMensagem_(texto) {
  const props  = PropertiesService.getScriptProperties();
  const token  = props.getProperty('TG_BOT_TOKEN');
  const chatId = props.getProperty('TG_CHANNEL_ID');
  if (!token || !chatId) return;

  UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id:              chatId,
      text:                 texto,
      parse_mode:           'Markdown',
      disable_notification: true,
    }),
    muteHttpExceptions: true,
  });
}

// Converte file_id em URL pública de download
function getFilePath_(fileId) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TG_BOT_TOKEN');
  if (!token) return '';

  const res  = UrlFetchApp.fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
    { muteHttpExceptions: true }
  );
  const data = JSON.parse(res.getContentText());
  if (!data.ok || !data.result.file_path) return '';

  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
}

// Extrai file_id de qualquer tipo de mensagem retornada pelo Telegram
function extrairFileId_(msg) {
  if (!msg) return null;
  const campos = ['audio', 'video', 'document', 'voice', 'video_note'];
  for (const c of campos) {
    if (msg[c] && msg[c].file_id) return msg[c].file_id;
  }
  return null;
}

// =============================================================================
// CHARTS HELPER (reaproveitado do registros1.txt)
// =============================================================================
function gravarRegistroFinal_(threadId, titulo, artistas, genero, tipo, fileUrl, capaUrl, timestamp) {
  const chartsId = PropertiesService.getScriptProperties().getProperty('CHARTS_SHEET_ID');
  if (!chartsId) return; // silencioso se não configurado

  const ss  = SpreadsheetApp.openById(chartsId);
  const aba = ss.getSheetByName('Registros') || ss.getSheets()[0];
  if (!aba) return;

  aba.appendRow([
    threadId,
    titulo    || '',
    artistas  || '',
    genero    || '',
    tipo      || '',
    fileUrl   || '',
    capaUrl   || '',
    timestamp || new Date().toISOString(),
    1, // contagem inicial de plays
  ]);
}

// =============================================================================
// SPREADSHEET HELPERS
// =============================================================================

// Lê uma aba e retorna array de objetos {coluna: valor}
function lerAba_(ss, nomeAba) {
  const sheet = ss.getSheetByName(nomeAba);
  if (!sheet) return [];

  const dados = sheet.getDataRange().getValues();
  if (dados.length < 2) return [];

  const headers = dados[0].map(h => String(h).trim());
  return dados.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

// Appenda uma linha na aba (cria a aba se não existir)
function appendToAba_(ss, nomeAba, valores) {
  let sheet = ss.getSheetByName(nomeAba);
  if (!sheet) sheet = ss.insertSheet(nomeAba);
  sheet.appendRow(valores);
}

// Resolve o nome da aba de conteúdo baseado no tipo/categoria do upload
function resolverAbaPorTipo_(tipo) {
  if (!tipo) return ABA.musicas;
  const t = tipo.toLowerCase();
  if (t === 'musicvideo' || t === 'musicvideos' || t === 'clip') return ABA.musicvideos;
  if (t === 'video' || t === 'videos')                           return ABA.videos;
  if (t === 'album' || t === 'albuns')                           return ABA.albuns;
  return ABA.musicas;
}
