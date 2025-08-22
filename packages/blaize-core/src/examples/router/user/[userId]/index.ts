import { z } from 'zod';

import { Blaize } from '../../../../index';

export const getUserRoute = Blaize.Router.createGetRoute({
  schema: {
    response: z.object({
      message: z.string(),
      timestamp: z.number(),
    }),
    params: z.object({
      userId: z.string(),
    }),
    query: z.object({
      q: z.string().optional(),
    }),
  },
  handler: async ({ request }, params) => {
    const { q } = request.query;

    if (q === 'test') {
      return {
        message: `rebuild user ${params.userId}`,
        timestamp: Date.now(),
      };
    }
    return {
      message: `hello user ${params.userId}`,
      timestamp: Date.now(),
    };
  },
});

export const postUserRoute = Blaize.Router.createPostRoute({
  schema: {
    body: z.object({
      name: z.string(),
      age: z.number(),
    }),
    response: z.object({
      timestamp: z.number(),
      message: z.string(),
    }),
    params: z.object({
      userId: z.string(),
    }),
  },
  handler: async (ctx, params) => {
    return {
      message: `hello user ${params.userId}`,
      timestamp: Date.now(),
    };
  },
});
