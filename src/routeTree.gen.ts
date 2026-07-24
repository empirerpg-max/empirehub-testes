import { Route as rootRoute } from './routes/__root'
import { Route as IndexRoute } from './routes/index'
import { Route as PlayIndexRoute } from './routes/play.index'

export const routeTree = rootRoute.addChildren([
  IndexRoute,
  PlayIndexRoute,
])
