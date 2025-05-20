import { createRoute } from 'blaizejs';
import { z } from 'zod';

export default createRoute({
  GET: {
    schema: {
      response: z.object({
        message: z.string()
      })
    },
    handler: async () => {
      return {
        message: 'Hello from BlaizeJS!'
      };
    }
  }
});