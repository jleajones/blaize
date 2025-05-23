import { createGetRoute } from 'blaizejs';
import { z } from 'zod';

export default createGetRoute({
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
