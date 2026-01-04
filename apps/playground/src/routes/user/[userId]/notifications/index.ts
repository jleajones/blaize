import { z } from 'zod';

import { appRouter } from '../../../../app-router';

// Define the event schemas
const NotificationEventSchema = z.object({
  id: z.string(),
  type: z.enum(['info', 'warning', 'error', 'success']),
  title: z.string(),
  message: z.string(),
  timestamp: z.string(),
  read: z.boolean(),
});

const UserStatusEventSchema = z.object({
  userId: z.string(),
  status: z.enum(['online', 'offline', 'away']),
  lastSeen: z.string(),
});

const SystemEventSchema = z.object({
  type: z.enum(['maintenance', 'update', 'alert']),
  message: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  affectedServices: z.array(z.string()).optional(),
});

export const getNotifications = appRouter.sse({
  schema: {
    params: z.object({
      userId: z.string(),
    }),
    query: z.object({
      types: z.array(z.string()).optional(), // Filter notification types
    }),
    events: {
      notification: NotificationEventSchema,
      userStatus: UserStatusEventSchema,
      system: SystemEventSchema,
      heartbeat: z.object({ timestamp: z.string() }),
    },
  },
  handler: async ({ stream, params, logger, eventBus }) => {
    logger.info(`[SSE] Client connected to notifications. UserId: ${params.userId || 'anonymous'}`);

    // Send initial connection confirmation
    stream.send('notification', {
      id: 'welcome',
      type: 'info',
      title: 'Connected',
      message: 'You are now connected to real-time notifications',
      timestamp: new Date().toISOString(),
      read: false,
    });

    const unsubscribe = eventBus.subscribe('order:*', event => {
      logger.debug('Broadcasting event to SSE', { type: event.type });

      stream.send('notification', {
        id: event.serverId,
        type: 'info',
        title: `Event: ${event.type}`,
        message: JSON.stringify(event.data),
        timestamp: new Date(event.timestamp).toISOString(),
        read: false,
      });
    });

    // Simulate various events
    const intervals: NodeJS.Timeout[] = [];

    // Send heartbeat every 10 seconds
    intervals.push(
      setInterval(() => {
        stream.send('heartbeat', {
          timestamp: new Date().toISOString(),
        });
      }, 10000)
    );

    // Clean up on disconnect
    stream.onClose(() => {
      logger.info(
        `[SSE] Client disconnected from notifications. UserId: ${params.userId || 'anonymous'}`
      );
      unsubscribe();
      intervals.forEach(interval => clearInterval(interval));
    });
  },
});
