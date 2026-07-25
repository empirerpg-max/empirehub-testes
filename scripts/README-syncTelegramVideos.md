# syncTelegramVideos — Empire Play

Script que sincroniza vídeos pendentes da aba **Videos** da planilha Empire Play com o canal hub do Telegram, preenchendo `telegram_file_id` e marcando `status = ready_telegram`.

---

## Fluxo resumido

```
Planilha (status=needs_telegram_file_id)
  └─► resultvideo-12.json  →  message_id original
        └─► Telegram forwardMessage  →  file_id
              └─► Google Apps Script doPost  →  planilha atualizada
```

---

## Pré-requisitos

| Variável de ambiente | Descrição |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token do bot (já em Secrets do GitHub) |
| `TELEGRAM_SOURCE_CHAT_ID` | ID do grupo **EMPIRE: Videos** (origem) |
| `TELEGRAM_HUB_CHAT_ID` | ID do canal/grupo hub do Empire Play |
| `SHEETS_API_KEY` | Chave de API do Google com acesso à Sheets v4 |
| `APPS_SCRIPT_URL` | URL do Web App do Apps Script (opcional — padrão já embutido) |

> **`SHEETS_API_KEY`**: gere em [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → API Key. Habilite a **Google Sheets API** no projeto e salve como secret `SHEETS_API_KEY` no GitHub.

O arquivo `resultvideo-12.json` (ou `resultvideo.json`) deve estar na raiz do repositório.

---

## Como rodar

### Opção 1 — GitHub Actions (recomendado, sem precisar do PC)

Acesse: **Actions → Sync Telegram Videos → Run workflow** e clique em **Run workflow**.

O job vai executar automaticamente usando os Secrets do repositório.

### Opção 2 — Local

```bash
# Instale dependências (apenas na primeira vez)
npm install

# Configure as envs
export TELEGRAM_BOT_TOKEN=seu_token
export TELEGRAM_SOURCE_CHAT_ID=-100xxxxxxx
export TELEGRAM_HUB_CHAT_ID=-100yyyyyyy
export SHEETS_API_KEY=AIzaSy...

# Rode o script
npm run sync:telegram
```

### Opção 3 — npx tsx (sem build)

```bash
SHEETS_API_KEY=xxx TELEGRAM_BOT_TOKEN=yyy ... npx tsx scripts/syncTelegramVideos.ts
```

---

## O que o script NÃO faz

- Não altera o layout da aba Videos (nenhuma coluna é adicionada ou removida)
- Não deleta mensagens do Telegram
- Não processa linhas com status diferente de `needs_telegram_file_id`
