import { z } from 'zod';

import { appRouter } from '../../app-router';

export const getHealth = appRouter.get({
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
      { id: '1', name: 'John Smow', userId: 'user1' },
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
