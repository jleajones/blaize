import { z } from 'zod';

import { appRouter } from '../basic';

export const IndexRoute = appRouter.get({
  schema: {
    response: z.object({
      message: z.string(),
      timestamp: z.number(),
    }),
  },
  handler: async ({ logger }) => {
    logger.info('Handling index route');
    // Returns a JSON object - will be sent using ctx.response.json()
    return {
      message: 'Hello, world!',
      timestamp: Date.now(),
    };
  },
});
