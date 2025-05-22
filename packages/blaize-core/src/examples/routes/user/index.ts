import { z } from 'zod';

import Blaize from '../../../../dist/index.js';

export default Blaize.createRoute({
  GET: {
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
  },
});
