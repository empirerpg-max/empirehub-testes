// Auto-generated route tree — mantido manual neste protótipo
import { createRootRouteWithContext, createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from './routes/__root'
import { Route as PlayRoute } from './routes/play.index'
import { QueryClient } from '@tanstack/react-query'

const rootRoute = RootRoute
const playRoute = PlayRoute

export const routeTree = rootRoute.addChildren([playRoute])
