import { z } from 'zod';

import { appRouter } from '../../app-router';
import { searchUsers } from '../../data/user';

/**
 * GET /user/search
 *
 * Search users by name or email
 *
 * @example
 * ```bash
 * curl -k "https://localhost:7485/user/search?q=sarah"
 * curl -k "https://localhost:7485/user/search?q=example.com"
 * ```
 */
export const searchUsersRoute = appRouter.get({
  schema: {
    query: z.object({
      q: z.string().min(1, 'Search query is required'),
    }),
    response: z.object({
      users: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          bio: z.string().optional(),
          avatar: z.object({
            filename: z.string(),
            mimetype: z.string(),
            size: z.number(),
            url: z.string(),
          }),
          role: z.enum(['admin', 'user', 'moderator']),
          isActive: z.boolean(),
        })
      ),
      count: z.number(),
      query: z.string(),
    }),
  },
  handler: async ({ ctx, logger }) => {
    const { q } = ctx.request.query;

    logger.info('Searching users', { query: q });

    const results = searchUsers(q);

    logger.info('Search completed', {
      query: q,
      resultsCount: results.length,
    });

    return {
      users: results,
      count: results.length,
      query: q,
    };
  },
});
