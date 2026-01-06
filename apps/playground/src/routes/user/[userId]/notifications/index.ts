/**
 * User Notifications SSE Route (Enhanced)
 *
 * GET /user/:userId/notifications - Real-time event stream
 *
 * Subscribes to all event types and streams them to connected clients.
 * Perfect for testing events triggered via Postman!
 */

import { z } from 'zod';

import { appRouter } from '../../../../app-router';

// Define the event schemas for SSE
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

    const unsubscribers: (() => void)[] = [];

    // ✅ Subscribe to user events
    unsubscribers.push(
      eventBus.subscribe('user:*', event => {
        logger.debug('Broadcasting user event to SSE', { type: event.type });

        stream.send('notification', {
          id: event.serverId,
          type: 'info',
          title: `👤 User Event: ${event.type}`,
          message: JSON.stringify(event.data),
          timestamp: new Date(event.timestamp).toISOString(),
          read: false,
        });
      })
    );

    // ✅ Subscribe to order events
    unsubscribers.push(
      eventBus.subscribe('order:*', event => {
        logger.debug('Broadcasting order event to SSE', { type: event.type });

        stream.send('notification', {
          id: event.serverId,
          type: 'success',
          title: `🛒 Order Event: ${event.type}`,
          message: JSON.stringify(event.data),
          timestamp: new Date(event.timestamp).toISOString(),
          read: false,
        });
      })
    );

    // ✅ Subscribe to system events
    unsubscribers.push(
      eventBus.subscribe('system:*', event => {
        logger.debug('Broadcasting system event to SSE', { type: event.type });

        const data = event.data as any;
        const severity = data.severity || 'low';
        const notifType =
          severity === 'high' || severity === 'critical'
            ? 'error'
            : severity === 'medium'
              ? 'warning'
              : 'info';

        stream.send('notification', {
          id: event.serverId,
          type: notifType,
          title: `⚙️ System Event: ${event.type}`,
          message: data.message || JSON.stringify(event.data),
          timestamp: new Date(event.timestamp).toISOString(),
          read: false,
        });
      })
    );

    // ✅ Subscribe to cache events (optional - useful for debugging)
    unsubscribers.push(
      eventBus.subscribe('cache:*', event => {
        logger.debug('Broadcasting cache event to SSE', { type: event.type });

        stream.send('notification', {
          id: event.serverId,
          type: 'info',
          title: `💾 Cache Event: ${event.type}`,
          message: JSON.stringify(event.data),
          timestamp: new Date(event.timestamp).toISOString(),
          read: false,
        });
      })
    );

    // ✅ Subscribe to queue events (optional - useful for debugging)
    unsubscribers.push(
      eventBus.subscribe('queue:*', event => {
        logger.debug('Broadcasting queue event to SSE', { type: event.type });

        stream.send('notification', {
          id: event.serverId,
          type: 'info',
          title: `📋 Queue Event: ${event.type}`,
          message: JSON.stringify(event.data),
          timestamp: new Date(event.timestamp).toISOString(),
          read: false,
        });
      })
    );

    // ✅ Subscribe to notification events
    unsubscribers.push(
      eventBus.subscribe('notification:*', event => {
        logger.debug('Broadcasting notification event to SSE', { type: event.type });

        stream.send('notification', {
          id: event.serverId,
          type: event.type === 'notification:sent' ? 'success' : 'warning',
          title: `🔔 Notification Event: ${event.type}`,
          message: JSON.stringify(event.data),
          timestamp: new Date(event.timestamp).toISOString(),
          read: false,
        });
      })
    );

    // ✅ Subscribe to report events
    unsubscribers.push(
      eventBus.subscribe('report:*', event => {
        logger.debug('Broadcasting report event to SSE', { type: event.type });

        stream.send('notification', {
          id: event.serverId,
          type: 'info',
          title: `📊 Report Event: ${event.type}`,
          message: JSON.stringify(event.data),
          timestamp: new Date(event.timestamp).toISOString(),
          read: false,
        });
      })
    );

    // Send heartbeat every 10 seconds
    const heartbeatInterval = setInterval(() => {
      stream.send('heartbeat', {
        timestamp: new Date().toISOString(),
      });
    }, 10000);

    // Clean up on disconnect
    stream.onClose(() => {
      logger.info(
        `[SSE] Client disconnected from notifications. UserId: ${params.userId || 'anonymous'}`
      );

      // Unsubscribe from all events
      unsubscribers.forEach(unsubscribe => unsubscribe());

      // Clear heartbeat
      clearInterval(heartbeatInterval);
    });
  },
});
