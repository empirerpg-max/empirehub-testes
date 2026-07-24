# Empire Play — Protótipo de Testes

Ambiente isolado para desenvolver e validar o **Empire Play** sem afetar o repositório oficial.

## Stack
- React 18 + TypeScript
- Vite 6
- Tailwind CSS v4
- Lucide React

## Rodar localmente

```bash
bun install
bun dev
```

OU com npm:

```bash
npm install
npm run dev
```

## Estrutura

```
src/
├── App.tsx                  # Entry: PlayProvider + PlayHomePage + MiniPlayer
├── main.tsx                 # Bootstrap React
├── styles.css               # Design tokens Empire (dark + neon green)
├── lib/
│   └── playContext.tsx      # Context global do player (copiado do oficial)
├── components/
│   └── MiniPlayer.tsx       # Player flutuante (Drive + YouTube)
├── pages/
│   └── PlayHomePage.tsx     # Seção Empire Play completa
└── mocks/
    ├── musicas.json         # Dados mockados de músicas
    ├── clipes.json          # Dados mockados de clipes
    ├── videos.json          # Dados mockados de vídeos
    └── charts.json          # Charts mockados (Spotify/Apple/YouTube)
```

## Fases do projeto

- [x] Fase 1 — Mapeamento do Empire Play
- [x] Fase 2 — Delimitação do recorte
- [x] Fase 3 — Estrutura do repositório de testes
- [x] Fase 4 — Primeira versão funcional (mocks locais)
- [ ] Fase 5 — Validação visual e de interação
- [ ] Fase 6 — Preparação da arquitetura de mídia
- [ ] Fase 7 — Fluxo Telegram como storage
- [ ] Fase 8 — Ambiente Local Bot API
- [ ] Fase 9 — Integração final
- [ ] Fase 10 — Checklist de produção
```
