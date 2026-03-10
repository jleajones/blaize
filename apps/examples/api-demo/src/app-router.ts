import { Blaize, type InferContext } from 'blaizejs';

import { server } from './server';

type AppContext = InferContext<typeof server>;
export const appRouter = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services']
>();
