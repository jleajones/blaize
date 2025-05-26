import { createGetRoute, createPostRoute } from 'blaizejs';
import { z } from 'zod';

export const getUser = createGetRoute({
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

export const postUser = createPostRoute({
  schema: {
    response: z.object({
      message: z.string(),
    }),
    body: z.object({
      name: z.string(),
    }),
  },
  // TODO: Add to docs handler return type also has runtime validation for Object types
  handler: async () => {
    return {
      message: 'Hello from Blaize and Bella on the user route!!',
    };
  },
});
