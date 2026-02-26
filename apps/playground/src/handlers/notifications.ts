import { z } from 'zod';

import { defineJob } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';
// ============================================================================
// Notification Queue Handlers
// ============================================================================

/**
 * Send notification handler - Quick (0.5-1 second)
 */
export const sendNotificationJob = defineJob({
  input: z.object({
    userId: z.string(),
    type: z.enum(['push', 'sms', 'in-app']),
    message: z.string(),
  }),
  output: z.object({
    notificationId: z.string(),
    delivered: z.boolean(),
  }),
  handler: async (ctx) => {
    const { userId, type } = ctx.data;

    ctx.logger.info('Sending notification', { userId, type });

    await ctx.progress(30, `Preparing ${type} notification`);
    await sleep(200);

    await ctx.progress(70, 'Delivering notification');
    await sleep(300 + Math.random() * 200);

    await ctx.progress(100, 'Notification sent');

    const notificationId = `notif-${Date.now()}-${userId}`;
    const delivered = Math.random() > 0.1; // 90% success rate

    ctx.logger.info('Notification result', { notificationId, delivered });

    return { notificationId, delivered };
  },
});
