// eslint-disable-next-line n/no-extraneous-import
import { getHello, postHello } from './routes/hello.js';

import type { BuildRouteRegistry } from 'blaizejs';

const _routes = {
  getHello,
  postHello,
} as const;

export type AppRoutes = BuildRouteRegistry<typeof _routes>;
