import { Middleware } from '../../../blaize-types/src/index';

export const createMockMiddleware = (
  options: Partial<Middleware> = {
    name: 'mock-middleware',
    execute: async (ctx, next) => {
      ctx.response.text('mock-middleware');
      return next();
    },
  }
): Middleware => {
  return options as Middleware;
};
