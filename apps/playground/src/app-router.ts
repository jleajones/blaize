import { Blaize, type InferContext } from 'blaizejs';

import { server } from '.';

import type { PlaygroundEvents } from './events';

type AppContext = InferContext<typeof server>;
export const appRouter = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services'],
  PlaygroundEvents
>();
