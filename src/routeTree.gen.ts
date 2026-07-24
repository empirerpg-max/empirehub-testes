import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

// Este arquivo é gerado manualmente para o ambiente de testes.
// Em produção, o TanStack Router CLI gera automaticamente.

import { Route as rootRoute } from "./routes/__root";
import { Route as IndexRoute } from "./routes/index";
import { Route as PlayIndexRoute } from "./routes/play.index";

const routeTree = rootRoute.addChildren([
  IndexRoute,
  PlayIndexRoute,
]);

export { routeTree };
