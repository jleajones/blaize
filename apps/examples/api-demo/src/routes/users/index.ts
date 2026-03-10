import { z } from 'zod';

import { appRouter } from '../../app-router';
import { createUser, listUsers, type User } from '../../data/users';

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'user']),
  createdAt: z.string(),
});

export const getUsers = appRouter.get({
  schema: {
    response: z.object({
      users: z.array(userSchema),
      total: z.number(),
    }),
  },
  handler: async () => {
    const users = listUsers();
    return { users, total: users.length };
  },
});

const createUserBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'user']).default('user'),
});

export const postUsers = appRouter.post({
  schema: {
    body: createUserBodySchema,
    response: z.object({ user: userSchema }),
  },
  handler: async ({ ctx }) => {
    const user: User = createUser(ctx.request.body);
    return { user };
  },
});
