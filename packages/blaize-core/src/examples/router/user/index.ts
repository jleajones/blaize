import { z } from 'zod';

import { appRouter } from '../../basic';

export default appRouter.get({
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
