import { getHello, postHello } from './routes';
import { getCacheEvents } from './routes/cache/stream';
import { getQueueStream } from './routes/queue/stream';
import { getUsers, createUser } from './routes/user';
import { getNotifications } from './routes/user/[userId]/notifications/index';

// import type { BuildRoutesRegistry } from 'blaizejs';

export const routes = {
  getHello,
  postHello,
  getUsers,
  createUser,
  getNotifications,
  getQueueStream,
  getCacheEvents,
} as const;

// export type AppType = BuildRoutesRegistry<typeof routes>;
