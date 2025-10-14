import { z } from 'zod';

import { appRouter } from '../app-router';

export const getHello = appRouter.get({
  schema: {
    response: z.object({
      name: z.string(),
    }),
  },
  handler: async () => {
    return {
      name: 'Hi, it is Blaize and Bella!',
    };
  },
});

export const postHello = appRouter.post({
  schema: {
    response: z.object({
      message: z.string(),
    }),
    body: z.object({
      name: z.string(),
    }),
  },
  handler: async ctx => {
    return {
      message: `Hello, ${ctx.request.body.name} from Blaize and Bella and the hello route!`,
    };
  },
});
