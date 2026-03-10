import { z } from 'zod';
import { NotFoundError } from 'blaizejs';

import { appRouter } from '../../app-router.js';
import { getUser } from '../../data/users.js';

export const getUserById = appRouter.get({
  schema: {
    params: z.object({ id: z.string() }),
    response: z.object({
      user: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        role: z.enum(['admin', 'user']),
        createdAt: z.string(),
      }),
    }),
  },
  handler: async ({ params }) => {
    const user = getUser(params.id);

    if (!user) {
      throw new NotFoundError(`User ${params.id} not found`);
    }

    return { user };
  },
});
