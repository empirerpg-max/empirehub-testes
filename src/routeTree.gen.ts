/* prettier-ignore */
/* eslint-disable */
// @ts-nocheck
// Este arquivo é gerado/mantido manualmente para o ambiente de testes.
// Em produção o TanStack Router Plugin/CLI gera automaticamente.

import type { FileRoutesByPath } from '@tanstack/react-router'

import { Route as rootRoute } from './routes/__root'
import { Route as IndexRoute } from './routes/index'
import { Route as PlayIndexRoute } from './routes/play.index'

// Monta a árvore de rotas
const rootRouteWithChildren = rootRoute.addChildren([
  IndexRoute,
  PlayIndexRoute,
])

export { rootRouteWithChildren as routeTree }

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": ["/", "/play/"]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/play/": {
      "filePath": "play.index.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
