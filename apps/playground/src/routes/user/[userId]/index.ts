import { z } from 'zod';

import { appRouter } from '../../../app.js';

export const getUserById = appRouter.get({
  schema: {
    params: z.object({
      userId: z.string(),
    }),
    query: z.object({
      lastName: z.string().optional(),
    }),
    response: z.object({
      user: z.object({
        id: z.string(),
        name: z.string(),
      }),
      posts: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          postId: z.string(),
        })
      ),
    }),
    // Note: Response schema is not defined here becuase the handler returns HTML directly
  },
  handler: async (_ctx, params) => {
    const user = {
      id: params.userId,
      name: `User ${params.userId}`,
      profileUrl: `https://localhost:7485/user/${params.userId}`,
    };

    const data = [
      { id: '1', name: 'Post 1', postId: 'post1' },
      { id: '2', name: 'Post 2', postId: 'post2' },
      { id: '3', name: 'Post 3', postId: 'post3' },
      { id: '4', name: 'Post 4', postId: `post4` },
    ];
    return {
      user,
      posts: data,
    };
  },
});
