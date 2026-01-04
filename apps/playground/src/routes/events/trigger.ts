import { z } from 'zod';

import { appRouter } from '../../app-router';

export const POST = appRouter.post({
  schema: {
    body: z.object({
      eventType: z.enum([
        'user:created',
        'user:login',
        'order:placed',
        'order:shipped',
        'system:alert',
      ]),
      data: z.record(z.unknown()),
    }),
    response: z.object({
      success: z.boolean(),
      eventId: z.string(),
      eventType: z.string(),
      message: z.string(),
    }),
  },
  handler: async ({ ctx, logger, eventBus }) => {
    const { eventType, data } = ctx.request.body;

    logger.info('Publishing event', { eventType, data });

    // Publish to EventBus
    await eventBus.publish(eventType as any, data);

    return {
      success: true,
      eventId: `evt_${Date.now()}`,
      eventType,
      message: `Event '${eventType}' published successfully. Check /user/:userId/notifications for updates!`,
    };
  },
});
