// ============================================================
// EMPIRE PLAY — Google Apps Script Unificado
// Planilha: 1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo
// Cole este arquivo no seu projeto Apps Script (Code.gs)
// Configure nas Script Properties:
//   TELEGRAM_TOKEN  → token do bot
//   TELEGRAM_CHAT_ID → ID do canal de storage
// ============================================================

var SPREADSHEET_ID  = '1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo';
var TELEGRAM_TOKEN  = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
var TELEGRAM_CHAT_ID = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');
var TELEGRAM_BASE   = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN;

// ── Mapeamento de abas ────────────────────────────────────────
var ABAS = {
  musicas:              'Musicas',
  comentarios_musicas:  'Comentarios_Musicas',
  music_videos:         'Music Videos',
  comentarios_mv:       'Comentarios_MV',
  videos:               'Videos',
  comentarios_videos:   'Comentarios_Videos',
  albuns:               'Albuns',
  comentarios_albuns:   'Comentarios_Albuns',
  top50spotify:         'Top_50_Spotify',
  topapple:             'Top_Songs_Apple_Music',
  topyt:                'Top_Videos_YT'
};

var ABAS_COMENTARIOS = {
  musicas: 'Comentarios_Musicas',
  mv:      'Comentarios_MV',
  videos:  'Comentarios_Videos',
  albuns:  'Comentarios_Albuns'
};

var ABAS_UPLOAD = {
  musica: 'Musicas',
  mv:     'Music Videos',
  video:  'Videos',
  album:  'Albuns'
};

// ── Helper de resposta CORS ───────────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// doGet — leitura de dados
// ============================================================
function doGet(e) {
  var acao = (e.parameter && e.parameter.acao) ? e.parameter.acao : '';
  var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Leitura direta de aba
  if (ABAS[acao]) {
    var dados = lerAba(ss, ABAS[acao]);
    return corsResponse({ success: true, data: dados });
  }

  // Comentários com filtro por tópico
  if (acao === 'getComentarios') {
    var tipo  = (e.parameter.tipo)  ? e.parameter.tipo  : 'musicas';
    var id    = (e.parameter.id)    ? e.parameter.id    : '';
    var nomAba = ABAS_COMENTARIOS[tipo] || 'Comentarios_Musicas';
    var todos  = lerAba(ss, nomAba);
    var filtrado = id ? todos.filter(function(r) { return String(r.topico_id) === String(id); }) : todos;
    return corsResponse({ success: true, data: filtrado });
  }

  return corsResponse({ success: false, error: 'Acao nao reconhecida: ' + acao });
}

// ============================================================
// doPost — escrita de dados
// ============================================================
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch(err) {}
  var acao = body.acao || '';
  var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ── Adicionar comentário ──────────────────────────────────
  if (acao === 'adicionarComentario') {
    var tipo      = body.tipo      || 'musicas';
    var topicoId  = body.topico_id || '';
    var autor     = body.autor     || 'Anônimo';
    var texto     = body.texto     || '';
    var emoji     = body.emoji     || '';
    var timestamp = new Date().toISOString();

    var nomAba = ABAS_COMENTARIOS[tipo] || 'Comentarios_Musicas';
    var aba    = ss.getSheetByName(nomAba);
    if (!aba) return corsResponse({ success: false, error: 'Aba nao encontrada: ' + nomAba });

    aba.appendRow([topicoId, autor, texto, emoji, timestamp]);

    // Notificação silenciosa no Telegram
    try {
      enviarMensagemTelegram('[' + tipo + '/' + topicoId + '] ' + autor + ': ' + emoji + ' ' + texto);
    } catch(err) {
      Logger.log('Telegram notify error: ' + err.message);
    }

    return corsResponse({ success: true });
  }

  // ── Upload de arquivo ou link ─────────────────────────────
  if (acao === 'uploadMedia') {
    var tipo2    = body.tipo    || 'musica';
    var titulo   = body.titulo  || '';
    var artista  = body.artista || '';
    var link     = body.link    || '';
    var base64   = body.base64  || '';
    var mimeType = body.mimeType || 'video/mp4';

    var telegramUrl = '';

    if (base64) {
      try {
        telegramUrl = enviarArquivoTelegram(base64, mimeType, titulo);
      } catch(err) {
        Logger.log('Telegram upload error: ' + err.message);
        telegramUrl = '';
      }
    } else if (link) {
      telegramUrl = link;
    }

    // Duplo registro
    gravarNaPlanilha(ss, tipo2, titulo, artista, telegramUrl);
    gravarRegistroFinal(ss, tipo2, titulo, artista, telegramUrl);

    return corsResponse({ success: true, url: telegramUrl });
  }

  return corsResponse({ success: false, error: 'Acao nao reconhecida: ' + acao });
}

// ============================================================
// Utilitários
// ============================================================

function lerAba(ss, nomeAba) {
  var aba = ss.getSheetByName(nomeAba);
  if (!aba) return [];
  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];
  var cabecalho = dados[0].map(function(h) {
    return String(h).toLowerCase().replace(/\s+/g, '_');
  });
  return dados.slice(1).map(function(row) {
    var obj = {};
    cabecalho.forEach(function(k, i) { obj[k] = row[i]; });
    return obj;
  });
}

function enviarMensagemTelegram(texto) {
  var url = TELEGRAM_BASE + '/sendMessage';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: texto,
      disable_notification: true
    }),
    muteHttpExceptions: true
  });
}

function enviarArquivoTelegram(base64, mimeType, nome) {
  var bytes    = Utilities.base64Decode(base64);
  var blob     = Utilities.newBlob(bytes, mimeType, nome || 'upload');
  var endpoint = mimeType.indexOf('video') >= 0 ? 'sendVideo'
    : mimeType.indexOf('audio') >= 0 ? 'sendAudio'
    : 'sendDocument';
  var fieldName = endpoint === 'sendVideo' ? 'video'
    : endpoint === 'sendAudio' ? 'audio'
    : 'document';

  var payload = { chat_id: TELEGRAM_CHAT_ID, disable_notification: true };
  payload[fieldName] = blob;

  var response = UrlFetchApp.fetch(TELEGRAM_BASE + '/' + endpoint, {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true
  });

  var result = JSON.parse(response.getContentText());
  if (!result.ok) {
    Logger.log('Telegram error: ' + response.getContentText());
    return '';
  }

  var msg      = result.result;
  var mediaObj = msg.video || msg.audio || msg.document || {};
  var fileId   = mediaObj.file_id || '';
  if (!fileId) return '';

  var fileResp = UrlFetchApp.fetch(TELEGRAM_BASE + '/getFile?file_id=' + fileId);
  var fileData = JSON.parse(fileResp.getContentText());
  var filePath = (fileData.result && fileData.result.file_path) ? fileData.result.file_path : '';

  return filePath ? ('https://api.telegram.org/file/bot' + TELEGRAM_TOKEN + '/' + filePath) : '';
}

function gravarNaPlanilha(ss, tipo, titulo, artista, url) {
  var nomeAba = ABAS_UPLOAD[tipo] || 'Musicas';
  var aba     = ss.getSheetByName(nomeAba);
  if (!aba) return;
  var id        = Utilities.getUuid();
  var timestamp = new Date().toISOString();
  aba.appendRow([id, titulo, artista, url, timestamp]);
}

// Duplo registro na aba Charts (reaproveitado de registros1.txt)
function gravarRegistroFinal(ss, tipo, titulo, artista, url) {
  try {
    var abaCharts = ss.getSheetByName('Charts');
    if (!abaCharts) abaCharts = ss.insertSheet('Charts');
    var timestamp = new Date().toISOString();
    // id | tipo | titulo | artista | url | timestamp | plays
    abaCharts.appendRow([Utilities.getUuid(), tipo, titulo, artista, url, timestamp, 0]);
  } catch(err) {
    Logger.log('Erro ao gravar Charts: ' + err.message);
  }
}
