import { z } from 'zod';

import { appRouter } from '../../app.js';

export const getUsers = appRouter.get({
  schema: {
    response: z.object({
      users: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          userId: z.string(),
        })
      ),
    }),
  },
  handler: async () => {
    const data = [
      { id: '1', name: 'John Doe', userId: 'user1' },
      { id: '2', name: 'Jane Smith', userId: 'user2' },
      { id: '3', name: 'Alice Johnson', userId: 'user3' },
      { id: '4', name: 'Bob Brown', userId: 'user4' },
      { id: '5', name: 'Charlie White', userId: 'user' },
    ];
    return {
      users: data,
    };
  },
});

export const postUser = appRouter.post({
  schema: {
    response: z.object({
      message: z.string(),
    }),
    body: z.object({
      name: z.string(),
    }),
  },
  // TODO: Add to docs handler return type also has runtime validation for Object types
  handler: async () => {
    return {
      message: 'Hello from Blaize and Bella on the user route!!',
    };
  },
});
