import { z } from 'zod';

import { appRouter } from '../app-router';

export const getHello = appRouter.get({
  schema: {
    response: z.object({
      status: z.string(),
    }),
  },
  handler: async ({}) => {
    return {
      status: 'ok',
    };
  },
});
