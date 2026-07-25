# syncTelegramVideos — Empire Play

Script que sincroniza vídeos pendentes da aba **Videos** da planilha Empire Play com o canal hub do Telegram, preenchendo `telegram_file_id` e marcando `status = ready_telegram`.

---

## Fluxo resumido

```
Planilha (status=needs_telegram_file_id)
  └─► resultvideo.json  →  message_id original
        └─► Telegram forwardMessage  →  file_id
              └─► Google Apps Script doPost  →  planilha atualizada
```

---

## Secrets configurados no repositório

| Secret no GitHub | Env usada pelo script | Descrição |
|---|---|---|
| `VITE_TELEGRAM_BOT_TOKEN` | `TELEGRAM_BOT_TOKEN` | Token do bot |
| `VITE_SOURCE_CHAT_ID` | `TELEGRAM_SOURCE_CHAT_ID` | ID do grupo EMPIRE: Videos (origem) |
| `VITE_TELEGRAM_CHANNEL_ID` | `TELEGRAM_HUB_CHAT_ID` | ID do canal/grupo hub Empire Play |
| `SHEETS_API_KEY` | `SHEETS_API_KEY` | Chave de API Google Sheets v4 |
| `APPS_SCRIPT_URL` | `APPS_SCRIPT_URL` | URL do Web App (opcional — padrão embutido) |

---

## Como rodar (sem PC)

**Actions → Sync Telegram Videos → Run workflow → Run workflow**

URL direta: https://github.com/empirerpg-max/empirehub-testes/actions/workflows/sync-telegram-videos.yml
