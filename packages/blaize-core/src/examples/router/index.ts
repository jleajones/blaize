import { z } from 'zod';

import { createGetRoute } from '@/router/index.js';

export const IndexRoute = createGetRoute({
  schema: {
    response: z.object({
      message: z.string(),
      timestamp: z.number(),
    }),
  },
  handler: async () => {
    // Returns a JSON object - will be sent using ctx.response.json()
    return {
      message: 'Hello, world!',
      timestamp: Date.now(),
    };
  },
});
