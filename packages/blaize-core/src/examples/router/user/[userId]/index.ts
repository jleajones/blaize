import { z } from 'zod';

import { NotFoundError } from '../../../../errors/not-found-error';
import { appRouter } from '../../../basic';
import { users } from '../../../users';

export const getUserRoute = appRouter.get({
  schema: {
    response: z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
    }),
    params: z.object({
      userId: z.coerce.number(),
    }),
  },
  handler: async (_ctx, params) => {
    const user = users.find(user => user.id === Number(params.userId));
    if (!user) {
      throw new NotFoundError('User not found', {
        resourceType: 'User',
        resourceId: params.userId.toString(),
        suggestion: 'Please check the user ID and try again.',
      });
    }
    // const { q } = request.query;
    return user;
  },
});

export const postUserRoute = appRouter.post({
  schema: {
    body: z.object({
      name: z.string(),
      age: z.number(),
    }),
    response: z.object({
      timestamp: z.number(),
      message: z.string(),
    }),
    params: z.object({
      userId: z.string(),
    }),
  },
  handler: async (ctx, params) => {
    return {
      message: `hello user ${params.userId}`,
      timestamp: Date.now(),
    };
  },
});
