import { getHello, postHello } from './routes/hello';
import { getNotifications } from './routes/user/[userId]/notifications/index';

// import type { BuildRoutesRegistry } from 'blaizejs';

export const routes = {
  getHello,
  postHello,
  getNotifications,
} as const;

// export type AppType = BuildRoutesRegistry<typeof routes>;
