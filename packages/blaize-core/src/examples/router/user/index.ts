import { z } from 'zod';

import { Blaize } from '../../../index';

export default Blaize.Router.createGetRoute({
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
