import { Blaize, type InferContext } from 'blaizejs';

import { server } from '.';

type AppContext = InferContext<typeof server>;
export const appRouter = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services']
>();
