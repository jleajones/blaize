import type { BuildRoutesRegistry } from '@blaizejs/types';

import { getHello, postHello } from './routes/hello.js';

const _routes = {
  getHello,
  postHello,
} as const;

export type AppRoutes = BuildRoutesRegistry<typeof _routes>;
