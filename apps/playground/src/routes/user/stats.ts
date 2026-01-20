import { z } from 'zod';

import { appRouter } from '../../app-router';
import { getUserStats } from '../../data/user';
/**
 * GET /user/stats
 *
 * Get user statistics
 *
 * @example
 * ```bash
 * curl -k https://localhost:7485/user/stats
 * ```
 */
export const getUsersStats = appRouter.get({
  schema: {
    response: z.object({
      total: z.number(),
      active: z.number(),
      inactive: z.number(),
      byRole: z.object({
        admin: z.number(),
        moderator: z.number(),
        user: z.number(),
      }),
      withCoverPhoto: z.number(),
    }),
  },
  handler: async ({ logger }) => {
    logger.info('Fetching user statistics');

    const stats = getUserStats();

    return stats;
  },
});
