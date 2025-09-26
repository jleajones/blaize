import { z } from 'zod';

import { appRouter } from '../../../../app.js';

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
  handler: async (stream, ctx, params) => {
    console.log(`[SSE] Client connected to notifications. UserId: ${params.userId || 'anonymous'}`);

    // Send initial connection confirmation
    stream.send('notification', {
      id: 'welcome',
      type: 'info',
      title: 'Connected',
      message: 'You are now connected to real-time notifications',
      timestamp: new Date().toISOString(),
      read: false,
    });

    // Simulate various events
    let notificationCounter = 0;
    const intervals: NodeJS.Timeout[] = [];

    // Send periodic notifications (simulate real events)
    intervals.push(
      setInterval(() => {
        notificationCounter++;
        const types: Array<'info' | 'warning' | 'error' | 'success'> = [
          'info',
          'warning',
          'error',
          'success',
        ];
        const randomType = types[Math.floor(Math.random() * types.length)]!;

        stream.send('notification', {
          id: `notif-${notificationCounter}`,
          type: randomType,
          title: `Notification #${notificationCounter}`,
          message: `This is a ${randomType} notification sent at ${new Date().toLocaleTimeString()}`,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }, 5000) // Every 5 seconds
    );

    // Send user status updates
    intervals.push(
      setInterval(() => {
        const statuses: Array<'online' | 'offline' | 'away'> = ['online', 'offline', 'away'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)]!;

        stream.send('userStatus', {
          userId: `user-${Math.floor(Math.random() * 100)}`,
          status: randomStatus,
          lastSeen: new Date().toISOString(),
        });
      }, 8000) // Every 8 seconds
    );

    // Send occasional system events
    intervals.push(
      setInterval(() => {
        const systemTypes: Array<'maintenance' | 'update' | 'alert'> = [
          'maintenance',
          'update',
          'alert',
        ];
        const severities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

        stream.send('system', {
          type: systemTypes[Math.floor(Math.random() * systemTypes.length)]!,
          message: 'System event: Scheduled maintenance window approaching',
          severity: severities[Math.floor(Math.random() * severities.length)]!,
          affectedServices: ['API', 'Database'],
        });
      }, 15000) // Every 15 seconds
    );

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
      console.log(
        `[SSE] Client disconnected from notifications. UserId: ${params.userId || 'anonymous'}`
      );
      intervals.forEach(interval => clearInterval(interval));
    });
  },
});
