import { z } from 'zod';

import { appRouter } from '../app.js';

export const getHello = appRouter.get({
  schema: {
    response: z.object({
      name: z.string(),
    }),
  },
  handler: async () => {
    return {
      name: 'Hi, it is BlaizeJS!',
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
  handler: async () => {
    return {
      message: 'Hello from Blaize and Bella and the hello route!',
    };
  },
});
