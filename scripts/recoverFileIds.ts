/**
 * recoverFileIds.ts
 *
 * Script de RECUPERAÇÃO: lê o histórico do canal hub via getUpdates /
 * forwardedFrom, identifica os vídeos já encaminhados e atualiza a
 * planilha SEM reenviar nada.
 *
 * Fluxo:
 *  1. Lê a aba Videos e coleta as linhas ainda pendentes
 *     (status=needs_telegram_file_id, telegram_file_id vazio).
 *  2. Busca mensagens no canal hub via getUpdates (polling)
 *     ou via getChatHistory com offset progressivo.
 *  3. Para cada mensagem de vídeo encontrada no hub, verifica se
 *     ela foi encaminhada do grupo origem (forward_from_chat +
 *     forward_from_message_id) e cruza com o resultvideo.json para
 *     descobrir a qual video_ID da planilha ela pertence.
 *  4. Envia o file_id para o Apps Script (mesmo endpoint do sync principal).
 *
 * Envs (mesmas do syncTelegramVideos):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_SOURCE_CHAT_ID
 *   TELEGRAM_HUB_CHAT_ID
 *   SHEETS_API_KEY
 *   APPS_SCRIPT_URL  (opcional)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import { URL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const SOURCE_CHAT_ID = process.env.TELEGRAM_SOURCE_CHAT_ID ?? "";
const HUB_CHAT_ID = process.env.TELEGRAM_HUB_CHAT_ID ?? "";
const APPS_SCRIPT_URL =
  (process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_URL.trim()) ||
  "https://script.google.com/macros/s/AKfycbyN38Ec8myFrEamUf0YwB_RG_2pRTrA92odxVyBuUACraMNPAnwe2FxMKqKEs_2zHcjmg/exec";
const SHEETS_API_KEY = process.env.SHEETS_API_KEY ?? "";
const SPREADSHEET_ID = "1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo";
const SHEET_NAME = "Videos";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface TgMessage {
  message_id: number;
  video?: { file_id: string; file_unique_id: string };
  document?: { file_id: string; file_unique_id: string };
  forward_origin?: {
    type: string;
    chat?: { id: number };
    message_id?: number;
  };
  // legado (bots mais antigos)
  forward_from_chat?: { id: number };
  forward_from_message_id?: number;
}

interface TgUpdate {
  update_id: number;
  channel_post?: TgMessage;
  message?: TgMessage;
}

interface ExportMessage {
  id: number;
  type: string;
  media_type?: string;
  reply_to_message_id?: number;
}

interface TelegramExport {
  messages: ExportMessage[];
}

interface VideoRow {
  id: string;
  telegram_topic_id: string;
  arquivo_fonte: string;
  telegram_file_id: string;
  status: string;
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────────
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} → ${url}`);
  return res.json() as Promise<T>;
}

function postToAppsScript(url: string, payload: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const doRequest = (targetUrl: string, hops = 0) => {
      if (hops > 5) return reject(new Error("Too many redirects"));
      const parsed = new URL(targetUrl);
      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            doRequest(res.headers.location, hops + 1);
            return;
          }
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () =>
            res.statusCode && res.statusCode >= 400
              ? reject(new Error(`HTTP ${res.statusCode}: ${data}`))
              : resolve(data)
          );
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    };
    doRequest(url);
  });
}

// ─── Planilha ───────────────────────────────────────────────────────────────────
async function fetchPendingRows(): Promise<VideoRow[]> {
  const range = encodeURIComponent(`${SHEET_NAME}!A1:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${SHEETS_API_KEY}`;
  const data = await getJson<{ values: string[][] }>(url);
  const [header, ...rows] = data.values;
  const col = (n: string) => header.indexOf(n);
  return rows
    .map((r) => ({
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

// ─── Telegram: busca mensagens do canal hub ──────────────────────────────────────────
/**
 * Usa getUpdates para coletar mensagens recebidas pelo bot no canal hub.
 * Pagina até esgotar (offset progressivo).
 * ATENÇÃO: getUpdates só retorna mensagens não confirmadas (pending).
 * Se o bot já consumiu os updates antes, esse método não retorna nada.
 * Nesse caso, usamos getChatHistory via copyMessage approach descrito abaixo.
 */
async function fetchHubMessagesViaUpdates(): Promise<TgMessage[]> {
  const messages: TgMessage[] = [];
  let offset = 0;
  let hasMore = true;

  console.log("  📶 Buscando updates do bot (getUpdates)...");
  while (hasMore) {
    const url = `${TELEGRAM_API}/getUpdates?offset=${offset}&limit=100&allowed_updates=["channel_post","message"]`;
    const data = await getJson<{ ok: boolean; result: TgUpdate[] }>(url);
    if (!data.ok || data.result.length === 0) {
      hasMore = false;
      break;
    }
    for (const update of data.result) {
      const msg = update.channel_post ?? update.message;
      if (msg && (msg.video || msg.document)) messages.push(msg);
      offset = update.update_id + 1;
    }
    if (data.result.length < 100) hasMore = false;
  }
  return messages;
}

/**
 * Tenta recuperar mensagens encaminhadas usando forwardMessage com
 * message_id incrementalmente a partir de um ponto de referência.
 * Isso só funciona se o bot for admin do canal hub.
 *
 * Estratégia: tenta getMessages via copyMessage dry-run ou
 * usa getChat + forwardMessage de um range de IDs.
 *
 * Abordagem mais confiável para canais: usa o endpoint
 * https://api.telegram.org/bot.../getUpdates com allowed_updates vazio
 * para pegar o último update_id e reconstruir o offset.
 */
async function fetchHubVideoMessages(): Promise<TgMessage[]> {
  // Primeira tentativa: getUpdates
  const fromUpdates = await fetchHubMessagesViaUpdates();
  if (fromUpdates.length > 0) {
    console.log(`  ✅ ${fromUpdates.length} mensagem(ns) encontrada(s) via getUpdates.`);
    return fromUpdates;
  }

  // Segunda tentativa: reenviar mensagens de um range de IDs do hub
  // para um chat temporário (o próprio bot) para capturar o file_id.
  // Usa getUpdates após cada forward para coletar o resultado.
  console.log("  ⚠️  getUpdates vazio. Tentando varredura por message_id no hub...");
  return await scanHubByMessageIds();
}

/**
 * Varre message_ids do canal hub encaminhando para o próprio bot (chat privado).
 * Usa forwardMessage para obter o file_id sem criar duplicatas no hub.
 * O destino é o chat privado do bot (usa o chat_id do próprio bot via getMe).
 */
async function scanHubByMessageIds(): Promise<TgMessage[]> {
  // Pega o ID do próprio bot para usar como destino temporário
  const me = await getJson<{ ok: boolean; result: { id: number } }>(
    `${TELEGRAM_API}/getMe`
  );
  if (!me.ok) throw new Error("Não foi possível obter informações do bot via getMe.");
  const botId = me.result.id;
  console.log(`  🤖 Bot ID: ${botId}`);

  const messages: TgMessage[] = [];
  // Tenta IDs de 1 até 2000 (ajuste conforme quantidade de mensagens no hub)
  const MAX_ID = 2000;
  const BATCH = 20;
  let emptyStreak = 0;

  for (let msgId = 1; msgId <= MAX_ID; msgId += BATCH) {
    const batch = Array.from({ length: BATCH }, (_, i) => msgId + i);
    for (const id of batch) {
      try {
        const fwd = await getJson<{
          ok: boolean;
          result?: TgMessage;
          description?: string;
        }>(
          `${TELEGRAM_API}/forwardMessage?chat_id=${botId}&from_chat_id=${HUB_CHAT_ID}&message_id=${id}`
        );
        if (fwd.ok && fwd.result && (fwd.result.video || fwd.result.document)) {
          messages.push(fwd.result);
          emptyStreak = 0;
          process.stdout.write(`✓`);
        } else {
          emptyStreak++;
          process.stdout.write(`.`);
        }
      } catch {
        emptyStreak++;
        process.stdout.write(`x`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    console.log(` [${msgId}-${msgId + BATCH - 1}]`);
    // Para se ficar muito tempo sem encontrar vídeos (hub provavelmente acabou)
    if (emptyStreak > 100) {
      console.log("  🛑 Muitas mensagens vazias consecutivas, encerrando varredura.");
      break;
    }
  }
  return messages;
}

// ─── Cruzamento hub ↔ planilha via resultvideo.json ────────────────────────────────────
function loadExportedChat(): TelegramExport {
  const candidates = [
    path.join(__dirname, "..", "resultvideo-12.json"),
    path.join(__dirname, "..", "resultvideo.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8")) as TelegramExport;
  }
  throw new Error("resultvideo-12.json / resultvideo.json não encontrado.");
}

/**
 * Para cada mensagem do hub que veio via forwardMessage,
 * o campo forward_origin.message_id (ou forward_from_message_id legado)
 * é o message_id original no grupo de origem.
 *
 * Cruzamos esse message_id com o resultvideo.json:
 *   resultvideo.json[message].id === forwardOriginMessageId
 *   && resultvideo.json[message].reply_to_message_id === topicId
 *
 * Aí sabemos qual topicId corresponde a essa mensagem,
 * e daí qual linha da planilha atualizar.
 */
function buildTopicToRowMap(
  pendingRows: VideoRow[]
): Map<number, VideoRow> {
  const map = new Map<number, VideoRow>();
  for (const row of pendingRows) {
    const tid = parseInt(row.telegram_topic_id, 10);
    if (!isNaN(tid)) map.set(tid, row);
  }
  return map;
}

function buildMsgIdToTopicMap(
  messages: ExportMessage[]
): Map<number, number> {
  /** messageId (no grupo origem) → topicId */
  const map = new Map<number, number>();
  for (const m of messages) {
    if (
      m.type === "message" &&
      m.media_type === "video_file" &&
      m.reply_to_message_id !== undefined
    ) {
      map.set(m.id, m.reply_to_message_id);
    }
  }
  return map;
}

function getForwardOriginMessageId(msg: TgMessage): number | null {
  // API nova
  if (msg.forward_origin?.type === "channel" && msg.forward_origin.message_id) {
    return msg.forward_origin.message_id;
  }
  // API legada
  if (msg.forward_from_message_id) return msg.forward_from_message_id;
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔧 Empire Play — Recover File IDs (sem reenvio)");
  console.log("═══════════════════════════════════════");

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

  // 1. Planilha: linhas pendentes
  console.log("\n📊 Buscando linhas pendentes na planilha...");
  const pendingRows = await fetchPendingRows();
  console.log(`   ${pendingRows.length} linha(s) pendentes.`);
  if (pendingRows.length === 0) {
    console.log("✅ Nada a fazer.");
    return;
  }

  // 2. resultvideo.json: mapeia message_id → topicId
  const chat = loadExportedChat();
  const msgIdToTopic = buildMsgIdToTopicMap(chat.messages);
  const topicToRow = buildTopicToRowMap(pendingRows);
  console.log(`✅ ${msgIdToTopic.size} vídeos mapeados no histórico exportado.`);

  // 3. Busca mensagens já encaminhadas no hub
  console.log("\n📡 Buscando mensagens de vídeo no canal hub...");
  const hubMessages = await fetchHubVideoMessages();
  console.log(`\n   ${hubMessages.length} mensagem(ns) de vídeo encontrada(s) no hub.`);

  if (hubMessages.length === 0) {
    console.log("⚠️  Nenhuma mensagem encontrada no hub. Tente rodar o sync principal.");
    return;
  }

  // 4. Cruza hub ↔ planilha e atualiza
  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of hubMessages) {
    const fileId = msg.video?.file_id ?? msg.document?.file_id;
    if (!fileId) { skipped++; continue; }

    const originMsgId = getForwardOriginMessageId(msg);
    if (!originMsgId) {
      // Mensagem do hub sem forward_origin: não conseguimos identificar
      console.warn(`  ⚠️  msg ${msg.message_id} sem forward_origin, pulando.`);
      skipped++;
      continue;
    }

    const topicId = msgIdToTopic.get(originMsgId);
    if (!topicId) {
      skipped++;
      continue;
    }

    const row = topicToRow.get(topicId);
    if (!row) {
      skipped++;
      continue;
    }

    console.log(`\n─── ${row.id} (topic: ${topicId}, origin_msg: ${originMsgId}) ───`);
    console.log(`  🔑 file_id: ${fileId}`);
    console.log("  📝 Atualizando planilha...");
    try {
      const resp = await postToAppsScript(APPS_SCRIPT_URL, {
        id: row.id,
        telegram_file_id: fileId,
      });
      console.log(`  ✅ OK — ${resp.substring(0, 80)}`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${(err as Error).message}`);
      errors++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("\n═══════════════════════════════════════");
  console.log(`📋 Resumo:`);
  console.log(`   ✅ Atualizados: ${success}`);
  console.log(`   ⏭️  Pulados:     ${skipped}`);
  console.log(`   ❌ Erros:       ${errors}`);
  if (success < pendingRows.length) {
    console.log(`\n⚠️  ${pendingRows.length - success} linha(s) não recuperada(s).`);
    console.log("   Se o hub não tem as mensagens encaminhadas, rode o sync principal.");
  }
}

main().catch((err) => {
  console.error("\n❌ Erro fatal:", err);
  process.exit(1);
});
