import { Blaize } from 'blaizejs';
import { z } from 'zod';

export default Blaize.createRoute({
  GET: {
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
  },
  POST: {
    schema: {
      body: z.object({
        name: z.string(),
        age: z.number(),
      }),
      response: z.object({
        message: z.string(),
        timestamp: z.number(),
      }),
    },
    handler: async (ctx, params) => {
      return {
        message: `hello user ${params.userId}`,
        timestamp: Date.now(),
      };
    },
  },
});
