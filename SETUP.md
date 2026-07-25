# Empire Hub — Guia de Setup Completo

Este documento cobre a configuração do backend (Google Apps Script) e do frontend (React/Vite) para o ambiente de produção.

---

## 1. Backend — Google Apps Script

### 1.1 Criar o projeto GAS

1. Acesse [script.google.com](https://script.google.com) e crie um **novo projeto**.
2. Renomeie para `Empire Hub Backend`.
3. Cole o conteúdo de `backend/Code.gs` no arquivo `Código.gs`.

### 1.2 Configurar Secrets

Vá em **Configurações do projeto → Propriedades do Script** e adicione:

| Chave | Valor |
|-------|-------|
| `TG_BOT_TOKEN` | Token do seu bot (ex: `7123456789:AAF...`) |
| `TG_CHANNEL_ID` | ID numérico do canal de storage (ex: `-1001234567890`) |
| `CHARTS_SHEET_ID` | ID da planilha de Charts |

> **Como obter o Channel ID:** envie uma mensagem no canal via bot e acesse `https://api.telegram.org/bot<TOKEN>/getUpdates`

### 1.3 Bot como Administrador

O bot precisa ser **administrador** do canal de storage para poder postar arquivos e mensagens.

### 1.4 Fazer o Deploy

1. Clique em **Implantar → Nova implantação**
2. Tipo: **Web App**
3. Executar como: **Eu (minha conta)**
4. Quem tem acesso: **Qualquer pessoa**
5. Clique em **Implantar** e copie a URL gerada

Formato da URL: `https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec`

---

## 2. Frontend — Vite / React

### 2.1 Configurar .env

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_GAS_URL=https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec
```

### 2.2 Instalar e rodar

```bash
npm install
npm run dev
```

---

## 3. Estrutura das Abas (Planilha Empire Play)

ID: `1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo`

O backend mapeia automaticamente estas abas:

| Aba | Uso |
|-----|-----|
| `Musicas` | Músicas (áudio) |
| `Comentarios_Musicas` | Comentários de músicas |
| `Music Videos` | Music videos / clips |
| `Comentarios_MV` | Comentários de MVs |
| `Videos` | Vídeos gerais |
| `Comentarios_Videos` | Comentários de vídeos |
| `Albuns` | Álbuns |
| `Comentarios_Albuns` | Comentários de álbuns |
| `Top_50_Spotify` | Charts Spotify |
| `Top_Songs_Apple_Music` | Charts Apple Music |
| `Top_Videos_YT` | Charts YouTube |

A planilha de **Charts** usa a aba `Registros` (criada automaticamente se não existir).

---

## 4. Fluxo de Upload (Resumo)

```
Usuário faz upload no app
  → UploadForm.tsx converte arquivo para base64
  → sheetsAPI.ts envia POST action=uploadArquivo para o GAS
  → GAS decodifica base64 → Blob → envia ao Telegram (silencioso)
  → Telegram retorna file_id
  → GAS chama getFile → monta URL https://api.telegram.org/file/bot<TOKEN>/<path>
  → GAS salva na aba correta da planilha Empire Play
  → GAS salva também na planilha de Charts (gravarRegistroFinal)
  → GAS retorna { status:'success', thread_id, file_id, file_url }
  → MiniPlayer.tsx detecta URL .mp4/telegram → usa <video> nativo
```

---

## 5. Validação Manual (curl)

```bash
# Testar GET conteúdo músicas
curl "https://script.google.com/macros/s/SEU_ID/exec?action=conteudo&categoria=musicas"

# Testar GET comentários
curl "https://script.google.com/macros/s/SEU_ID/exec?action=comentarios&categoria=musicas&idTopico=TPC_ABC123"

# Testar POST novo comentário
curl -X POST -H 'Content-Type: application/json' \
  -d '{"action":"novoComentario","categoria":"musicas","idTopico":"TPC_ABC123","idJogador":"u1","nomeJogador":"Teste","comentario":"Boa música!"}' \
  "https://script.google.com/macros/s/SEU_ID/exec"
```

---

## 6. Arquivos do Frontend

| Arquivo | Função |
|---------|--------|
| `src/services/sheetsAPI.ts` | Toda comunicação com o GAS |
| `src/components/MiniPlayer.tsx` | Player universal (áudio + vídeo popup) |
| `src/components/ForumChat.tsx` | Fórum estilo Telegram com polling |
| `src/components/UploadForm/UploadForm.tsx` | Upload com Telegram invisível |
