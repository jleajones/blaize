import { createGetRoute, createPostRoute } from 'blaizejs';
import { z } from 'zod';

export const getHello = createGetRoute({
  schema: {
    response: z.object({
      message: z.string(),
    }),
  },
  handler: async () => {
    return {
      message: 'Hello from BlaizeJS!',
    };
  },
});

export const postHello = createPostRoute({
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
      message: 'Hello from Blaize and Bella!',
    };
  },
});
