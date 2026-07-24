# Empire Telegram API

API intermediária entre o **Empire Play** e o **Telegram Bot API**.

O front **nunca** fala diretamente com o Telegram. Toda comunicação passa por aqui.

---

## Instalação e execução

```bash
cd api
npm install

# Copie o .env.example da raiz e preencha
cp ../.env.example ../.env

# Desenvolvimento (reinicia ao salvar)
npm run dev

# Produção
npm start
```

A API sobe em `http://localhost:3001` por padrão.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `BOT_TOKEN` | Sim | Token do bot (@BotFather) |
| `CHAT_ID` | Sim | ID do canal/grupo de storage |
| `PORT` | Não | Porta da API (padrão: 3001) |
| `TELEGRAM_API_ROOT` | Não | URL do Local Bot API Server (padrão: api.telegram.org) |
| `VITE_TELEGRAM_API_BASE` | Sim (front) | URL base que o Vite usa para chamar esta API |

---

## Endpoints

### `GET /health`
Healthcheck simples.

```json
{ "ok": true, "ts": 1721000000000 }
```

---

### `POST /upload`
Faz upload de um arquivo de áudio ou vídeo para o Telegram e salva no catálogo.

**Body:** `multipart/form-data`

| Campo | Tipo | Descrição |
|---|---|---|
| `file` | File | Arquivo de áudio ou vídeo |
| `meta` | JSON string | `{ titulo, artista, capa }` |

**Response:**
```json
{
  "file_id": "BQACAgIAAxk...",
  "message_id": 42,
  "chat_id": "-1001234567890",
  "source": "telegram",
  "mime_type": "audio/mpeg",
  "file_size": 4200000,
  "duration": 210,
  "titulo": "Neon Empire",
  "artista": "Lana Empire",
  "capa": ""
}
```

---

### `POST /catalog`
Registra uma mídia de YouTube ou Drive no catálogo **sem fazer upload**.

**Body:** JSON

| Campo | Tipo | Descrição |
|---|---|---|
| `file_id` | string | YouTube video-id ou Drive file-id |
| `source` | string | `"youtube"` ou `"drive"` |
| `titulo` | string | Título da faixa |
| `artista` | string | Nome do artista |
| `capa` | string | Drive file-id ou URL da capa |
| `mime_type` | string | Opcional |

**Response:** objeto registrado.

---

### `GET /catalog`
Retorna todos os itens do catálogo em ordem cronológica decrescente.

**Response:** array de `TelegramMediaMeta`.

---

### `GET /play/:fileId`
Resolve `getFile` no Bot API e faz pipe do stream de bytes para o cliente.
O `<audio>` do front recebe o stream diretamente.

> **Limite cloud:** O Bot API comum só serve download até **20 MB**.
> Para arquivos maiores, use o Local Bot API Server com `--local` (veja abaixo).

---

### `DELETE /catalog/:fileId`
Remove o item do catálogo local. Não apaga a mensagem do canal Telegram.

**Response:** `{ "ok": true }`

---

## Fluxo de upload (arquivo direto)

```
Usuário seleciona arquivo no app
        ↓
Front: POST /upload (multipart)
        ↓
API: tgUploadFile() → sendAudio / sendVideo / sendDocument
        ↓
Telegram retorna: file_id, message_id, duration
        ↓
API: insertMedia() → catalog.db
        ↓
Front recebe TelegramMediaMeta
        ↓
Front cria PlayItem com audioSrc: "tg:" + file_id
        ↓
Front cria tópico no Fórum com os metadados
```

## Fluxo de playback

```
Usuário clica em play
        ↓
playContext detecta audioSrc começa com "tg:"
        ↓
telegramStreamUrl(file_id) → "http://localhost:3001/play/BQACAgI..."
        ↓
<audio src="http://localhost:3001/play/..."> → GET /play/:fileId
        ↓
API: getFile → file_path
        ↓
Se --local: sendFile do disco (ilimitado)
Se cloud:   pipe do link temporário (válido 1h, limite 20 MB)
```

---

## As 3 fontes de mídia

| Fonte | `source` | `file_id` | Upload para Telegram? |
|---|---|---|---|
| YouTube | `youtube` | Video ID (11 chars) | Não — YouTube serve direto |
| Google Drive | `drive` | Drive file-id | Não — Drive serve via proxy |
| Upload direto | `telegram` | `file_id` do Telegram | Sim — via `POST /upload` |

Independente da fonte, ao confirmar o lançamento:
1. Metadados são registrados no catálogo (`catalog.db`)
2. Um tópico é criado no Fórum com título, artista e capa
3. O item aparece na aba Músicas pronto para tocar

---

## Local Bot API Server (arquivos > 20 MB)

Para remover o limite de 20 MB de download e habilitar uploads até 2000 MB:

### 1. Rodar o servidor local

```bash
docker run -d --name telegram-bot-api \
  -p 8081:8081 \
  -v $(pwd)/telegram-data:/var/lib/telegram-bot-api \
  -e TELEGRAM_API_ID=SEU_API_ID \
  -e TELEGRAM_API_HASH=SEU_API_HASH \
  -e TELEGRAM_BOT_TOKEN=SEU_TOKEN \
  aiogram/telegram-bot-api:latest \
  --local
```

### 2. Migrar o bot

Antes de apontar para o servidor local, o bot deve fazer logout do servidor público:

```bash
curl https://api.telegram.org/botSEU_TOKEN/logOut
```

### 3. Apontar a API para o servidor local

No `.env`:
```env
TELEGRAM_API_ROOT=http://localhost:8081/bot
```

No modo `--local`:
- `file_path` retornado por `getFile` é um **caminho absoluto** no disco
- A API serve o arquivo diretamente via `res.sendFile(filePath)` sem link temporário
- Download sem limite de tamanho
- Upload até **2000 MB**

> Em produção, coloque um proxy reverso (nginx/caddy) com TLS na frente do servidor local.

---

## Checklist de produção

- [ ] Autenticar requisições à API (JWT ou API Key no header)
- [ ] Rate limiting no `/upload` (ex: 10 uploads/hora por usuário)
- [ ] Validar tipo MIME e tamanho máximo no multer
- [ ] TLS obrigatório em produção
- [ ] Proxy reverso (nginx/caddy) na frente da API
- [ ] Backup do `catalog.db` (ou migrar para Postgres/PlanetScale)
- [ ] Fallback se Telegram falhar (retornar erro claro ao front)
- [ ] Migrar `logOut` antes de trocar para Local Bot API Server
