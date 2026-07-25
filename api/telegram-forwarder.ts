/**
 * telegram-forwarder.ts
 * Empire Play — Bot que encaminha mensagens de vídeos do grupo legado
 * para os tópicos corretos no novo supergrupo de destino.
 *
 * Fluxo:
 *  1. Lê videos.json (gerado da planilha EmpirePlay_Hub.xlsx > aba Videos)
 *  2. Para cada vídeo com telegram_msg_id:
 *     a. forwardMessage do grupo de origem para o tópico do grupo de destino
 *  3. Salva um log com message_id novo (para salvar file_id depois)
 *
 * USO:
 *   BOT_TOKEN=xxx SOURCE_CHAT_ID=-100xxx DEST_CHAT_ID=-100yyy npx ts-node api/telegram-forwarder.ts
 */

const BASE = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface VideoEntry {
  id_video: number;
  telegram_msg_id: number | string;
  telegram_group_id: number;
  tipo: string;
  titulo_topico: string;
  artista: string;
  titulo_video: string;
  id_usuario: string;
  nome_usuario: string;
  data_criacao: string;
  video_url: string;
  file_source: string;
  file_name: string;
  duracao_segundos: number | string;
  largura: number | string;
  altura: number | string;
  file_size_bytes: number | string;
}

interface ForwardResult {
  id_video: number;
  titulo_topico: string;
  orig_msg_id: number;
  new_msg_id: number | null;
  dest_topic_id: number | null;
  status: 'ok' | 'skip' | 'error';
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function tgRequest(method: string, body: object): Promise<any> {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`[${method}] ${json.description}`);
  return json.result;
}

/**
 * Cria um tópico no grupo de destino e retorna o message_thread_id.
 * Se o tópico já existir (por nome), retorna o existente do cache.
 */
async function createForumTopic(
  chatId: string,
  title: string,
  topicCache: Map<string, number>
): Promise<number> {
  if (topicCache.has(title)) return topicCache.get(title)!;
  const result = await tgRequest('createForumTopic', {
    chat_id: chatId,
    name: title.slice(0, 128), // limite Telegram
  });
  const threadId: number = result.message_thread_id;
  topicCache.set(title, threadId);
  return threadId;
}

/**
 * Encaminha uma mensagem de mídia do grupo de origem para um tópico do destino.
 * Usa forwardMessage (mantém o arquivo original sem re-upload).
 */
async function forwardToTopic(
  fromChatId: string,
  msgId: number,
  destChatId: string,
  threadId: number
): Promise<number> {
  const result = await tgRequest('forwardMessage', {
    chat_id: destChatId,
    from_chat_id: fromChatId,
    message_id: msgId,
    message_thread_id: threadId,
  });
  return result.message_id;
}

/**
 * Recupera o file_id de uma mensagem de vídeo encaminhada.
 * Útil para salvar na planilha após o forward.
 */
export async function getFileIdFromMessage(
  chatId: string,
  msgId: number
): Promise<string | null> {
  try {
    // Telegram não tem getMessageById direto; usamos copyMessage com dummy
    // A abordagem real é capturar via webhook ou usar Bot API updates.
    // Aqui retornamos null e sugerimos captura via webhook ao receber o forward.
    console.warn(`[getFileId] Use webhook para capturar file_id da msg ${msgId}`);
    return null;
  } catch {
    return null;
  }
}

/**
 * Gera URL temporária de reprodução a partir de um file_id.
 * A URL expira mas o file_id é permanente — chame esta função no momento do play.
 */
export async function getTelegramPlayUrl(fileId: string): Promise<string | null> {
  try {
    const result = await tgRequest('getFile', { file_id: fileId });
    return `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${result.file_path}`;
  } catch (e) {
    console.error('[getTelegramPlayUrl]', e);
    return null;
  }
}

// ─── Upload direto pelo app → Telegram ───────────────────────────────────────
/**
 * Envia um arquivo (Buffer) para um tópico de storage no Telegram.
 * Retorna o file_id permanente para salvar na planilha/banco.
 *
 * @param fileBuffer  Conteúdo do arquivo em Buffer
 * @param fileName    Nome do arquivo com extensão
 * @param mimeType    MIME type (ex: 'video/mp4', 'audio/mpeg')
 * @param storageChatId  ID do canal/grupo de storage
 * @param threadId    ID do tópico (message_thread_id) — opcional
 */
export async function uploadFileToTelegram(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  storageChatId: string,
  threadId?: number
): Promise<{ file_id: string; message_id: number } | null> {
  try {
    const form = new FormData();
    form.append('chat_id', storageChatId);
    if (threadId) form.append('message_thread_id', String(threadId));

    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');
    const fieldName = isVideo ? 'video' : isAudio ? 'audio' : 'document';
    const endpoint = isVideo ? 'sendVideo' : isAudio ? 'sendAudio' : 'sendDocument';

    form.append(fieldName, new Blob([fileBuffer], { type: mimeType }), fileName);

    const res = await fetch(`${BASE}/${endpoint}`, { method: 'POST', body: form });
    const json = await res.json();
    if (!json.ok) throw new Error(json.description);

    const msg = json.result;
    const mediaObj = msg.video || msg.audio || msg.document;
    return {
      file_id: mediaObj.file_id,
      message_id: msg.message_id,
    };
  } catch (e) {
    console.error('[uploadFileToTelegram]', e);
    return null;
  }
}

// ─── Runner principal ─────────────────────────────────────────────────────────
async function main() {
  const SOURCE_CHAT = process.env.SOURCE_CHAT_ID!;  // grupo legado EMPIRE: Videos
  const DEST_CHAT   = process.env.DEST_CHAT_ID!;    // novo supergrupo com tópicos
  const DRY_RUN     = process.env.DRY_RUN === 'true';
  const DELAY_MS    = Number(process.env.DELAY_MS ?? 800); // respeitar rate limit

  if (!process.env.BOT_TOKEN || !SOURCE_CHAT || !DEST_CHAT) {
    console.error('❌ Defina BOT_TOKEN, SOURCE_CHAT_ID e DEST_CHAT_ID no .env');
    process.exit(1);
  }

  // Carregar dados (gerado pela planilha / script Python)
  const { readFileSync } = await import('fs');
  const videos: VideoEntry[] = JSON.parse(
    readFileSync('./api/data/videos.json', 'utf-8')
  );

  const topicCache = new Map<string, number>();
  const results: ForwardResult[] = [];
  let skipped = 0, errors = 0, forwarded = 0;

  for (const video of videos) {
    // Só encaminha vídeos que vieram do Telegram
    if (video.file_source !== 'telegram') {
      results.push({
        id_video: video.id_video,
        titulo_topico: video.titulo_topico,
        orig_msg_id: Number(video.telegram_msg_id),
        new_msg_id: null,
        dest_topic_id: null,
        status: 'skip',
      });
      skipped++;
      continue;
    }

    const origMsgId = Number(video.telegram_msg_id);
    if (!origMsgId || origMsgId < 0) {
      skipped++; continue;
    }

    try {
      // 1. Criar tópico no destino (ou reaproveitar pelo cache)
      let threadId: number | null = null;
      if (!DRY_RUN) {
        threadId = await createForumTopic(DEST_CHAT, video.titulo_topico, topicCache);
        // Delay entre criações de tópico
        await new Promise(r => setTimeout(r, DELAY_MS));
        // 2. Encaminhar a mensagem de mídia para o tópico criado
        const newMsgId = await forwardToTopic(SOURCE_CHAT, origMsgId, DEST_CHAT, threadId);
        await new Promise(r => setTimeout(r, DELAY_MS));

        results.push({
          id_video: video.id_video,
          titulo_topico: video.titulo_topico,
          orig_msg_id: origMsgId,
          new_msg_id: newMsgId,
          dest_topic_id: threadId,
          status: 'ok',
        });
        forwarded++;
        console.log(`✅ [${video.id_video}] ${video.titulo_topico.slice(0, 60)} → thread ${threadId}, msg ${newMsgId}`);
      } else {
        // Dry run: apenas logar
        console.log(`[DRY] [${video.id_video}] Encaminharia msg ${origMsgId} → tópico "${video.titulo_topico.slice(0,50)}"`);
        results.push({ id_video: video.id_video, titulo_topico: video.titulo_topico, orig_msg_id: origMsgId, new_msg_id: null, dest_topic_id: null, status: 'ok' });
        forwarded++;
      }
    } catch (e: any) {
      console.error(`❌ [${video.id_video}] ${video.titulo_topico}: ${e.message}`);
      results.push({
        id_video: video.id_video,
        titulo_topico: video.titulo_topico,
        orig_msg_id: origMsgId,
        new_msg_id: null,
        dest_topic_id: null,
        status: 'error',
        error: e.message,
      });
      errors++;
    }
  }

  // Salvar log de resultados
  const { writeFileSync } = await import('fs');
  writeFileSync('./api/data/forward-log.json', JSON.stringify(results, null, 2));

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Encaminhados: ${forwarded}`);
  console.log(`   ⏭  Ignorados:   ${skipped}  (Drive/YouTube — player usa link direto)`);
  console.log(`   ❌ Erros:        ${errors}`);
  console.log(`   📄 Log salvo em: api/data/forward-log.json`);
}

main().catch(console.error);
