import { RouteRegistry } from '@blaizejs/types';

declare global {
  namespace BlaizeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Routes extends RouteRegistry {}
  }
}

export type AppType = BlaizeJS.Routes;
