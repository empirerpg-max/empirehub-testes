// Apps Script — Planilha Empire Play
// ID: 1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo
//
// doPost aceita:
//   { action: "novoComentario", ... }  → adiciona comentário
//   { action: "atualizarVideo", id, telegram_file_id }  → grava file_id + status na aba Videos
//
// O script do GitHub Actions (syncTelegramVideos.ts) chama atualizarVideo
// depois de obter o file_id via forwardMessage no Telegram.

const SHEET_ID = "1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo";

const SHEETS = {
  musicas: "Musicas",
  musicvideos: "Music Videos",
  videos: "Videos"
};

const COMENTARIOS_SHEETS = {
  musicas: "Comentarios_Musicas",
  musicvideos: "Comentarios_MV",
  videos: "Comentarios_Videos"
};


function doGet(e) {
  const action = e.parameter.action || "musicas";
  const categoria = e.parameter.categoria || "musicas";
  let result;

  if (action === "conteudo") {
    result = getConteudo(categoria);
  } else if (action === "comentarios") {
    const idTopico = e.parameter.idTopico;
    result = getComentarios(categoria, idTopico);
  } else {
    result = { error: "Acao desconhecida" };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}


function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === "novoComentario") {
      return adicionarComentario(data);
    }

    if (data.action === "atualizarVideo") {
      return atualizarVideo(data);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Acao invalida" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ─── NOVA FUNÇÃO ─────────────────────────────────────────────────────────────
// Recebe: { action: "atualizarVideo", id: "VID_42", telegram_file_id: "BAACAgI..." }
// Localiza a linha pelo campo "id" na aba Videos e grava:
//   - telegram_file_id
//   - status = "ready_telegram"
function atualizarVideo(data) {
  const id = String(data.id || "").trim();
  const fileId = String(data.telegram_file_id || "").trim();

  if (!id || !fileId) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "id e telegram_file_id sao obrigatorios" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Videos");
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const colId       = headers.indexOf("id");
  const colFileId   = headers.indexOf("telegram_file_id");
  const colStatus   = headers.indexOf("status");

  if (colId === -1 || colFileId === -1 || colStatus === -1) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "Colunas id / telegram_file_id / status nao encontradas na aba Videos" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // Procura a linha com o id correspondente (pula o header na linha 1)
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][colId]).trim() === id) {
      const row = i + 1; // planilha é 1-based; values[0] é header = linha 1
      sheet.getRange(row, colFileId + 1).setValue(fileId);
      sheet.getRange(row, colStatus  + 1).setValue("ready_telegram");
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", row, id, telegram_file_id: fileId })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: "not_found", message: "Nenhuma linha com id=" + id })
  ).setMimeType(ContentService.MimeType.JSON);
}
// ─────────────────────────────────────────────────────────────────────────────


function getConteudo(categoria) {
  const sheetName = SHEETS[categoria];
  if (!sheetName) return { error: "Categoria invalida" };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);

  const itens = rows
    .filter(r => r.some(cell => cell !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[normalizeKey(h)] = r[i]; });
      return obj;
    });

  return { data: itens };
}


function getComentarios(categoria, idTopico) {
  const sheetName = COMENTARIOS_SHEETS[categoria];
  if (!sheetName) return { error: "Categoria invalida" };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);

  let comentarios = rows
    .filter(r => r.some(cell => cell !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[normalizeKey(h)] = r[i]; });
      return obj;
    });

  if (idTopico) {
    comentarios = comentarios.filter(c => String(c.id_do_topico) === String(idTopico));
  }

  return { data: comentarios };
}


function adicionarComentario(data) {
  const sheetName = COMENTARIOS_SHEETS[data.categoria] || COMENTARIOS_SHEETS.musicas;
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
  sheet.appendRow([
    data.idTopico,
    data.idJogador || "",
    data.nomeJogador || "Anonimo",
    data.comentario
  ]);
  return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}


function normalizeKey(header) {
  return header
    .toString()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}
