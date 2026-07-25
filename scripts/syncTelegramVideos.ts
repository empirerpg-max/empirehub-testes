/**
 * syncTelegramVideos.ts
 *
 * Para cada vídeo pendente na aba "Videos" da planilha Empire Play:
 *   1. Localiza o message_id no histórico exportado do Telegram
 *   2. Faz forwardMessage → hub para obter o telegram_file_id
 *   3. Atualiza a planilha Empire Play (Sheets API) com o file_id e status
 *   4. Notifica o Apps Script (planilha Charts) para manter o pipeline de Charts
 *
 * Critério de pendência: status IN ["draft", "needs_telegram_file_id"]
 *   AND arquivo_fonte = "telegram"
 *   AND telegram_file_id vazio
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import { URL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configurações ────────────────────────────────────────────────────────────
const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN ?? "";
const SOURCE_CHAT_ID   = process.env.TELEGRAM_SOURCE_CHAT_ID ?? "";
const HUB_CHAT_ID      = process.env.TELEGRAM_HUB_CHAT_ID ?? "";
const APPS_SCRIPT_URL  =
  (process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_URL.trim()) ||
  "https://script.google.com/macros/s/AKfycbyN38Ec8myFrEamUf0YwB_RG_2pRTrA92odxVyBuUACraMNPAnwe2FxMKqKEs_2zHcjmg/exec";
const SHEETS_API_KEY   = process.env.SHEETS_API_KEY ?? "";

// Planilha Empire Play (leitura + escrita via Sheets API)
const EMPIRE_PLAY_ID   = "1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo";
const SHEET_NAME       = "Videos";

// Status que indicam "precisa de file_id"
const PENDING_STATUSES = new Set(["draft", "needs_telegram_file_id"]);

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface VideoRow {
  rowIndex: number;     // linha real na planilha (base 1, já inclui header)
  id: string;
  telegram_topic_id: string;
  arquivo_fonte: string;
  telegram_file_id: string;
  status: string;
  // colunas extras que queremos preservar ao fazer o PATCH
  titulo: string;
  artista: string;
  tipo_video: string;
  enviado_por: string;
  data_upload: string;
  id_usuario: string;
}

interface TelegramMessage {
  id: number;
  type: string;
  action?: string;
  media_type?: string;
  reply_to_message_id?: number;
}

interface TelegramExport {
  messages: TelegramMessage[];
}

// ─── Helpers genéricos ────────────────────────────────────────────────────────
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} → ${url}\n${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * POST com JSON para o Google Apps Script.
 * O GAS redireciona 302 → URL final; o fetch do Node transforma POST→GET
 * no redirect. Usamos https nativo para seguir o redirect mantendo o body.
 */
function postToAppsScript(url: string, payload: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const doRequest = (targetUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error("Too many redirects"));
      const parsed = new URL(targetUrl);
      const lib = parsed.protocol === "https:" ? https : http;
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      };
      const req = lib.request(options, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          doRequest(res.headers.location, redirectCount + 1);
          res.resume();
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        });
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    };
    doRequest(url);
  });
}

// ─── Sheets API: leitura ──────────────────────────────────────────────────────
async function fetchSheetRows(): Promise<VideoRow[]> {
  const range = encodeURIComponent(`${SHEET_NAME}!A1:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${EMPIRE_PLAY_ID}/values/${range}?key=${SHEETS_API_KEY}`;
  const data = await fetchJson<{ values: string[][] }>(url);
  const [header, ...rows] = data.values;
  const col = (name: string) => header.indexOf(name);

  return rows
    .map((r, i) => ({
      rowIndex: i + 2, // +1 pelo header, +1 porque array é 0-based mas planilha é 1-based
      id:                r[col("id")]                ?? "",
      telegram_topic_id: r[col("telegram_topic_id")] ?? "",
      arquivo_fonte:     r[col("arquivo_fonte")]      ?? "",
      telegram_file_id:  r[col("telegram_file_id")]   ?? "",
      status:            r[col("status")]             ?? "",
      titulo:            r[col("titulo")]             ?? "",
      artista:           r[col("artista")]            ?? "",
      tipo_video:        r[col("tipo_video")]         ?? "",
      enviado_por:       r[col("enviado_por")]        ?? "",
      data_upload:       r[col("data_upload")]        ?? "",
      id_usuario:        r[col("id_usuario")]         ?? "",
    }))
    .filter(
      (r) =>
        r.arquivo_fonte === "telegram" &&
        r.telegram_file_id === "" &&
        PENDING_STATUSES.has(r.status)
    );
}

// ─── Sheets API: escrita (PATCH célula a célula) ──────────────────────────────
/**
 * Atualiza telegram_file_id e status na planilha Empire Play via Sheets API.
 * Usa batchUpdate para fazer as duas escritas em uma só chamada.
 */
async function updateEmpirePlaySheet(
  rowIndex: number,
  headerRow: string[],
  telegramFileId: string
): Promise<void> {
  const colFileId = headerRow.indexOf("telegram_file_id");
  const colStatus = headerRow.indexOf("status");

  if (colFileId === -1 || colStatus === -1) {
    throw new Error("Colunas telegram_file_id ou status não encontradas no header.");
  }

  // Converte índice de coluna (0-based) para letra de coluna (A, B, ..., Z, AA, ...)
  const toColLetter = (n: number): string => {
    let letter = "";
    n += 1; // 1-based
    while (n > 0) {
      const rem = (n - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      n = Math.floor((n - 1) / 26);
    }
    return letter;
  };

  const rangeFileId = `${SHEET_NAME}!${toColLetter(colFileId)}${rowIndex}`;
  const rangeStatus  = `${SHEET_NAME}!${toColLetter(colStatus)}${rowIndex}`;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${EMPIRE_PLAY_ID}/values:batchUpdate?key=${SHEETS_API_KEY}`;

  await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: [
        { range: rangeFileId, values: [[telegramFileId]] },
        { range: rangeStatus,  values: [["ready_telegram"]] },
      ],
    }),
  });
}

// ─── Apps Script: notifica planilha Charts ────────────────────────────────────
async function notifyChartsScript(id: string, telegramFileId: string): Promise<void> {
  console.log(`  🔗 Notificando Apps Script (Charts)...`);
  const response = await postToAppsScript(APPS_SCRIPT_URL, {
    id,
    telegram_file_id: telegramFileId,
  });
  console.log(`  📨 Resposta GAS: ${response.substring(0, 120)}`);
}

// ─── Telegram: histórico + forward ───────────────────────────────────────────
function loadExportedChat(): TelegramExport {
  const candidates = [
    path.join(__dirname, "..", "resultvideo-12.json"),
    path.join(__dirname, "..", "resultvideo.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`📂 Usando arquivo de histórico: ${p}`);
      return JSON.parse(fs.readFileSync(p, "utf-8")) as TelegramExport;
    }
  }
  throw new Error(
    "Arquivo resultvideo-12.json (ou resultvideo.json) não encontrado na raiz do repositório."
  );
}

function findMessageId(
  messages: TelegramMessage[],
  topicId: number
): number | null {
  const match = messages.find(
    (m) =>
      m.type === "message" &&
      m.media_type === "video_file" &&
      m.reply_to_message_id === topicId
  );
  return match?.id ?? null;
}

async function forwardAndGetFileId(messageId: number): Promise<string | null> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/forwardMessage`;
  const data = await fetchJson<{
    ok: boolean;
    result?: {
      video?: { file_id: string };
      document?: { file_id: string };
    };
    description?: string;
  }>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: HUB_CHAT_ID,
      from_chat_id: SOURCE_CHAT_ID,
      message_id: messageId,
    }),
  });
  if (!data.ok) {
    console.error(`  ⚠️  forwardMessage falhou: ${data.description}`);
    return null;
  }
  return data.result?.video?.file_id ?? data.result?.document?.file_id ?? null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Empire Play — Sync Telegram Videos");
  console.log("═══════════════════════════════════════");
  console.log(`🔗 Apps Script URL: ${APPS_SCRIPT_URL ? "✅ OK" : "❌ VAZIA"}`);

  const missing = [
    !BOT_TOKEN       && "TELEGRAM_BOT_TOKEN",
    !SOURCE_CHAT_ID  && "TELEGRAM_SOURCE_CHAT_ID",
    !HUB_CHAT_ID     && "TELEGRAM_HUB_CHAT_ID",
    !SHEETS_API_KEY  && "SHEETS_API_KEY",
  ].filter(Boolean);

  if (missing.length) {
    console.error(`❌ Envs faltando: ${missing.join(", ")}`);
    process.exit(1);
  }

  const chat     = loadExportedChat();
  const messages = chat.messages;
  console.log(`✅ Histórico carregado: ${messages.length} mensagens`);

  // Busca header separado para usar no batchUpdate
  const range = encodeURIComponent(`${SHEET_NAME}!A1:Z1`);
  const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${EMPIRE_PLAY_ID}/values/${range}?key=${SHEETS_API_KEY}`;
  const headerData = await fetchJson<{ values: string[][] }>(headerUrl);
  const headerRow = headerData.values[0];

  console.log("\n📊 Buscando linhas pendentes na planilha Empire Play...");
  const pendingRows = await fetchSheetRows();
  console.log(
    `   ${pendingRows.length} linha(s) com status em [${[...PENDING_STATUSES].join(", ")}] e arquivo_fonte=telegram`
  );

  if (pendingRows.length === 0) {
    console.log("\n✅ Nenhuma linha pendente. Nada a fazer.");
    return;
  }

  let success = 0;
  let skipped = 0;
  let errors  = 0;

  for (const row of pendingRows) {
    console.log(`\n─── ${row.id} — "${row.titulo}" (${row.artista}) ───`);
    console.log(`    status: ${row.status} | topic_id: ${row.telegram_topic_id}`);

    const topicId = parseInt(row.telegram_topic_id, 10);
    if (isNaN(topicId)) {
      console.warn("  ⚠️  telegram_topic_id inválido, pulando.");
      skipped++;
      continue;
    }

    const messageId = findMessageId(messages, topicId);
    if (!messageId) {
      console.warn(`  ⚠️  Nenhum vídeo encontrado no histórico para topic_id ${topicId}.`);
      skipped++;
      continue;
    }
    console.log(`  ✅ message_id encontrado: ${messageId}`);

    console.log(`  📤 Encaminhando mensagem ${messageId} → hub...`);
    let fileId: string | null = null;
    try {
      fileId = await forwardAndGetFileId(messageId);
    } catch (err) {
      console.error(`  ❌ Erro no forwardMessage: ${(err as Error).message}`);
      errors++;
      continue;
    }

    if (!fileId) {
      console.warn("  ⚠️  file_id não obtido no retorno do Telegram.");
      skipped++;
      continue;
    }
    console.log(`  ✅ file_id: ${fileId}`);

    // 1. Atualiza planilha Empire Play (Sheets API)
    console.log("  📝 Atualizando planilha Empire Play...");
    try {
      await updateEmpirePlaySheet(row.rowIndex, headerRow, fileId);
      console.log("  ✅ Empire Play atualizada (telegram_file_id + status → ready_telegram)");
    } catch (err) {
      console.error(`  ❌ Erro ao atualizar Empire Play: ${(err as Error).message}`);
      errors++;
      continue;
    }

    // 2. Notifica Apps Script para atualizar planilha Charts
    try {
      await notifyChartsScript(row.id, fileId);
      console.log("  ✅ Charts notificado via Apps Script");
    } catch (err) {
      // Erro no Charts não bloqueia — o Empire Play já foi atualizado
      console.warn(`  ⚠️  Apps Script (Charts) retornou erro (não crítico): ${(err as Error).message}`);
    }

    success++;
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n═══════════════════════════════════════");
  console.log("📋 Resumo:");
  console.log(`   ✅ Sucesso:  ${success}`);
  console.log(`   ⏭️  Pulados: ${skipped}`);
  console.log(`   ❌ Erros:   ${errors}`);
}

main().catch((err) => {
  console.error("\n❌ Erro fatal:", err);
  process.exit(1);
});
