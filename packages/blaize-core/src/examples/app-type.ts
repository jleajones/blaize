import { BuildRouteRegistry, CreateClient } from '@blaizejs/types';

import { getUserRoute, postUserRoute } from './router/user/[userId]/index';

const _routes = {
  getUserRoute,
  postUserRoute,
} as const;

export type AppRoutes = BuildRouteRegistry<typeof _routes>;

type _BlaizeClient = CreateClient<AppRoutes>;
