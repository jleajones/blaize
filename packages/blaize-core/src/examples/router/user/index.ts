import { z } from 'zod';

import { appRouter } from '../../basic';
import { users } from '../../users';

export default appRouter.get({
  schema: {
    response: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
      })
    ),
    query: z.object({
      q: z.string().optional(),
    }),
  },
  handler: async ({ ctx }) => {
    const { q } = ctx.request.query;
    if (q) {
      // Filter users based on query
      return users.filter(user => user.name.includes(q));
    }
    // Returns a JSON object - will be sent using ctx.response.json()
    return users;
  },
});
