# Empire Play — Estrutura Técnica

Módulo de streaming do Empire Hub: músicas, álbuns, vídeos e clipes com fórum integrado.

---

## Estrutura

```
empire-play/
├── .env.example
├── scripts/
│   └── parse-telegram-videos.js   ← parser do export do Telegram
├── data/
│   ├── videos-parsed.json         ← gerado pelo parser (não versionado)
│   └── videos-parsed.csv          ← gerado pelo parser (não versionado)
└── src/
    ├── services/
    │   ├── telegramBot.ts     ← upload + getFile
    │   ├── googleDrive.ts     ← conversão de URLs do Drive
    │   ├── youtubeEmbed.ts    ← parser de URLs do YouTube
    │   └── sheetsAPI.ts       ← leitura/escrita na planilha
    └── components/
        └── UploadForm/
            └── UploadForm.tsx ← 3 métodos de upload
```

---

## Setup rápido

```bash
cp empire-play/.env.example .env
# Preencha as variáveis no .env

# Rodar o parser dos vídeos do Telegram:
node empire-play/scripts/parse-telegram-videos.js
# Gera empire-play/data/videos-parsed.csv — importe no Google Sheets
```

---

## Métodos de upload

| Método | Como usar | Resultado no player |
|---|---|---|
| YouTube | URL `youtu.be/...` | Embed `youtube-nocookie.com` |
| Google Drive | URL de compartilhamento | `uc?export=download&id=...` |
| Arquivo direto | `.mp3 / .mp4 / .wav` | Upload Telegram → `file_id` salvo no Sheets |

---

## Vídeos do JSON do Telegram

Os arquivos enviados diretamente no grupo não têm `file_id` no export JSON.
Para habilitá-los no player:

1. Encaminhe cada vídeo para o **bot de armazenamento** no Telegram
2. O bot responde com o `file_id`
3. Preencha a coluna `telegramFileId` no Sheets

O único vídeo **pronto agora** (sem reenvio) é:
- **Samantha Cooper Live at the Empire Festival** → link do Google Drive já disponível ✅

---

## Tipos de vídeo

| Hashtag do Telegram | Tipo interno |
|---|---|
| `#MusicVideo` | `musicvideo` |
| `#LyricVideo` | `lyricvideo` |
| `#AlternativeVideo` | `alternativevideo` |
| `#Video` | `video` |
