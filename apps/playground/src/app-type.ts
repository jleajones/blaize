import { getHello, postHello } from './routes/hello.js';

import type { BuildRoutesRegistry } from 'blaizejs';

export const routes = {
  getHello,
  postHello,
} as const;

export type AppType = BuildRoutesRegistry<typeof routes>;
