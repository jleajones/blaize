import { getHello, postHello } from './routes/hello.js';
import { getNotifications } from './routes/user/[userId]/notifications/index.js';

// import type { BuildRoutesRegistry } from 'blaizejs';

export const routes = {
  getHello,
  postHello,
  getNotifications,
} as const;

// export type AppType = BuildRoutesRegistry<typeof routes>;
