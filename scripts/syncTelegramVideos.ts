/**
 * syncTelegramVideos.ts
 * Sincroniza vídeos pendentes da aba "Videos" da planilha Empire Play
 * com o canal hub do Telegram, preenchendo telegram_file_id e status.
 *
 * Envs necessárias (GitHub Secrets / .env local):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_SOURCE_CHAT_ID
 *   TELEGRAM_HUB_CHAT_ID
 *   APPS_SCRIPT_URL
 *   SHEETS_API_KEY  (chave de API pública do Google, com permissão Sheets v4)
 *
 * O arquivo resultvideo-12.json deve estar na raiz do repositório.
 * Fallback: se não existir, usa resultvideo.json (já presente no repo).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configurações ───────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const SOURCE_CHAT_ID = process.env.TELEGRAM_SOURCE_CHAT_ID ?? "";
const HUB_CHAT_ID = process.env.TELEGRAM_HUB_CHAT_ID ?? "";
const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ??
  "https://script.google.com/macros/s/AKfycbyN38Ec8myFrEamUf0YwB_RG_2pRTrA92odxVyBuUACraMNPAnwe2FxMKqKEs_2zHcjmg/exec";
const SHEETS_API_KEY = process.env.SHEETS_API_KEY ?? "";
const SPREADSHEET_ID = "1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo";
const SHEET_NAME = "Videos";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface VideoRow {
  rowIndex: number; // 1-based (sem contar cabeçalho)
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
  file?: string;
  file_id?: string;
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

/** Lê a aba Videos via Google Sheets API v4 (requer SHEETS_API_KEY) */
async function fetchSheetRows(): Promise<VideoRow[]> {
  const range = encodeURIComponent(`${SHEET_NAME}!A1:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${SHEETS_API_KEY}`;
  const data = await fetchJson<{ values: string[][] }>(url);
  const [header, ...rows] = data.values;

  // Mapeia nome de coluna → índice
  const col = (name: string) => header.indexOf(name);

  return rows
    .map((r, i) => ({
      rowIndex: i + 2, // +2: 1-based + cabeçalho
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

/** Carrega o JSON de histórico de mensagens do grupo */
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

/**
 * Procura a mensagem de vídeo no histórico exportado cujo
 * reply_to_message_id === telegram_topic_id fornecido.
 */
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

/** Encaminha a mensagem para o hub e retorna o file_id do vídeo */
async function forwardAndGetFileId(messageId: number): Promise<string | null> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/forwardMessage`;
  const body = {
    chat_id: HUB_CHAT_ID,
    from_chat_id: SOURCE_CHAT_ID,
    message_id: messageId,
  };

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
    body: JSON.stringify(body),
  });

  if (!data.ok) {
    console.error(`  ⚠️  forwardMessage falhou: ${data.description}`);
    return null;
  }

  return (
    data.result?.video?.file_id ?? data.result?.document?.file_id ?? null
  );
}

/** Atualiza telegram_file_id + status via Google Apps Script */
async function updateSheet(id: string, telegramFileId: string): Promise<void> {
  await fetchJson(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, telegram_file_id: telegramFileId }),
    redirect: "follow",
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Empire Play — Sync Telegram Videos");
  console.log("═══════════════════════════════════════");

  // Validação de envs obrigatórias
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

  // 1. Carrega histórico exportado
  const chat = loadExportedChat();
  const messages = chat.messages;
  console.log(`✅ Histórico carregado: ${messages.length} mensagens`);

  // 2. Lê linhas pendentes da planilha
  console.log("\n📊 Buscando linhas pendentes na planilha...");
  const pendingRows = await fetchSheetRows();
  console.log(`   ${pendingRows.length} linha(s) com status = needs_telegram_file_id`);

  if (pendingRows.length === 0) {
    console.log("\n✅ Nenhuma linha pendente. Nada a fazer.");
    return;
  }

  // 3. Processa cada linha
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

    // 3a. Acha o message_id original no histórico
    const messageId = findMessageId(messages, topicId);
    if (!messageId) {
      console.warn(
        `  ⚠️  Nenhum vídeo encontrado para topic_id ${topicId} no histórico.`
      );
      skipped++;
      continue;
    }
    console.log(`  ✅ message_id encontrado: ${messageId}`);

    // 3b. Encaminha para o hub
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

    // 3c. Atualiza a planilha via Apps Script
    console.log("  📝 Atualizando planilha...");
    try {
      await updateSheet(row.id, fileId);
      console.log("  ✅ Planilha atualizada (status → ready_telegram)");
      success++;
    } catch (err) {
      console.error(
        `  ❌ Erro ao atualizar planilha: ${(err as Error).message}`
      );
      errors++;
    }

    // Pequena pausa para não estourar rate limit da Telegram API
    await new Promise((r) => setTimeout(r, 500));
  }

  // 4. Resumo
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
