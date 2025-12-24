import { getHello, postHello } from './routes';
import { getCacheEvents } from './routes/cache/stream';
import { getQueueStream } from './routes/queue/stream';
import { getNotifications } from './routes/user/[userId]/notifications/index';

// import type { BuildRoutesRegistry } from 'blaizejs';

export const routes = {
  getHello,
  postHello,
  getNotifications,
  getQueueStream,
  getCacheEvents,
} as const;

// export type AppType = BuildRoutesRegistry<typeof routes>;
