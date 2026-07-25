/**
 * syncTelegramVideos.ts
 * Sincroniza vídeos pendentes da aba "Videos" da planilha Empire Play
 * com o canal hub do Telegram, preenchendo telegram_file_id e status.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import { URL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configurações ───────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const SOURCE_CHAT_ID = process.env.TELEGRAM_SOURCE_CHAT_ID ?? "";
const HUB_CHAT_ID = process.env.TELEGRAM_HUB_CHAT_ID ?? "";
const APPS_SCRIPT_URL =
  (process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_URL.trim()) ||
  "https://script.google.com/macros/s/AKfycbyN38Ec8myFrEamUf0YwB_RG_2pRTrA92odxVyBuUACraMNPAnwe2FxMKqKEs_2zHcjmg/exec";
const SHEETS_API_KEY = process.env.SHEETS_API_KEY ?? "";
const SPREADSHEET_ID = "1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo";
const SHEET_NAME = "Videos";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface VideoRow {
  rowIndex: number;
  id: string;
  telegram_topic_id: string;
  arquivo_fonte: string;
  telegram_file_id: string;
  status: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
 * O GAS redireciona 302 → URL final. O fetch nativo do Node rejeita
 * POST→redirect transformando em GET sem body. Usamos https nativo
 * para controlar o redirect manualmente.
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
          // Segue o redirect mantendo o body
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

async function fetchSheetRows(): Promise<VideoRow[]> {
  const range = encodeURIComponent(`${SHEET_NAME}!A1:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${SHEETS_API_KEY}`;
  const data = await fetchJson<{ values: string[][] }>(url);
  const [header, ...rows] = data.values;
  const col = (name: string) => header.indexOf(name);
  return rows
    .map((r, i) => ({
      rowIndex: i + 2,
      id: r[col("id")] ?? "",
      telegram_topic_id: r[col("telegram_topic_id")] ?? "",
      arquivo_fonte: r[col("arquivo_fonte")] ?? "",
      telegram_file_id: r[col("telegram_file_id")] ?? "",
      status: r[col("status")] ?? "",
    }))
    .filter(
      (r) =>
        r.arquivo_fonte === "telegram" &&
        r.telegram_file_id === "" &&
        r.status === "needs_telegram_file_id"
    );
}

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

async function updateSheet(id: string, telegramFileId: string): Promise<void> {
  console.log(`  🔗 Apps Script URL: ${APPS_SCRIPT_URL.substring(0, 60)}...`);
  const response = await postToAppsScript(APPS_SCRIPT_URL, {
    id,
    telegram_file_id: telegramFileId,
  });
  console.log(`  📨 Resposta GAS: ${response.substring(0, 100)}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Empire Play — Sync Telegram Videos");
  console.log("═══════════════════════════════════════");
  console.log(`🔗 Apps Script URL configurada: ${APPS_SCRIPT_URL ? "✅ OK" : "❌ VAZIA"}`);

  const missing = [
    !BOT_TOKEN && "TELEGRAM_BOT_TOKEN",
    !SOURCE_CHAT_ID && "TELEGRAM_SOURCE_CHAT_ID",
    !HUB_CHAT_ID && "TELEGRAM_HUB_CHAT_ID",
    !SHEETS_API_KEY && "SHEETS_API_KEY",
  ].filter(Boolean);

  if (missing.length) {
    console.error(`❌ Envs faltando: ${missing.join(", ")}`);
    process.exit(1);
  }

  const chat = loadExportedChat();
  const messages = chat.messages;
  console.log(`✅ Histórico carregado: ${messages.length} mensagens`);

  console.log("\n📊 Buscando linhas pendentes na planilha...");
  const pendingRows = await fetchSheetRows();
  console.log(`   ${pendingRows.length} linha(s) com status = needs_telegram_file_id`);

  if (pendingRows.length === 0) {
    console.log("\n✅ Nenhuma linha pendente. Nada a fazer.");
    return;
  }

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of pendingRows) {
    console.log(`\n─── ${row.id} (topic_id: ${row.telegram_topic_id}) ───`);

    const topicId = parseInt(row.telegram_topic_id, 10);
    if (isNaN(topicId)) {
      console.warn("  ⚠️  telegram_topic_id inválido, pulando.");
      skipped++;
      continue;
    }

    const messageId = findMessageId(messages, topicId);
    if (!messageId) {
      console.warn(`  ⚠️  Nenhum vídeo encontrado para topic_id ${topicId}.`);
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

    console.log("  📝 Atualizando planilha...");
    try {
      await updateSheet(row.id, fileId);
      console.log("  ✅ Planilha atualizada (status → ready_telegram)");
      success++;
    } catch (err) {
      console.error(`  ❌ Erro ao atualizar planilha: ${(err as Error).message}`);
      errors++;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n═══════════════════════════════════════");
  console.log(`📋 Resumo:`);
  console.log(`   ✅ Sucesso:  ${success}`);
  console.log(`   ⏭️  Pulados: ${skipped}`);
  console.log(`   ❌ Erros:   ${errors}`);
}

main().catch((err) => {
  console.error("\n❌ Erro fatal:", err);
  process.exit(1);
});
