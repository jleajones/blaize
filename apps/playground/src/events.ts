/**
 * Playground Event Schemas (Enhanced)
 *
 * Complete event schemas for Redis-integrated playground:
 * - User lifecycle events
 * - Order processing events
 * - System events
 * - Cache operation events (NEW)
 * - Queue job events (NEW)
 * - Report generation events (NEW)
 */

import { z } from 'zod';
 
import { cacheEventBusSchemas } from '@blaizejs/plugin-cache';
import { queueEventBusSchemas } from '@blaizejs/plugin-queue';

export const playgroundEvents = {
  // ==========================================================================
  // User Events
  // ==========================================================================
  'user:created': z.object({
    userId: z.string(),
    email: z.string().email(),
    timestamp: z.number(),
    metadata: z.record(z.unknown()).optional(),
  }),

  'user:login': z.object({
    userId: z.string(),
    ip: z.string().optional(),
    timestamp: z.number().optional(),
  }),

  'user:logout': z.object({
    userId: z.string(),
    sessionDuration: z.number().optional(),
  }),

  // ==========================================================================
  // Order Events
  // ==========================================================================
  'order:placed': z.object({
    orderId: z.string(),
    userId: z.string(),
    total: z.number(),
    items: z.number(),
    timestamp: z.number().optional(),
  }),

  'order:shipped': z.object({
    orderId: z.string(),
    trackingNumber: z.string(),
    carrier: z.string().optional(),
  }),

  'order:delivered': z.object({
    orderId: z.string(),
    deliveredAt: z.number(),
    signedBy: z.string().optional(),
  }),

  // ==========================================================================
  // Cache Events (NEW - Published Cache Plugin)
  // ==========================================================================
  ...cacheEventBusSchemas,
  // ==========================================================================
  // Queue Events (NEW - Published Queue Plugin)
  // ==========================================================================
  ...queueEventBusSchemas,

  // ==========================================================================
  // Report Events (NEW)
  // ==========================================================================
  'report:requested': z.object({
    reportId: z.string(),
    reportType: z.enum(['daily', 'weekly', 'monthly', 'annual', 'custom']),
    requestedBy: z.string(),
  }),

  'report:generated': z.object({
    reportId: z.string(),
    reportType: z.string(),
    generatedAt: z.number(),
    result: z.unknown(),
    durationMs: z.number().optional(),
  }),

  // ==========================================================================
  // System Events (Enhanced)
  // ==========================================================================
  'system:alert': z.object({
    type: z.enum(['info', 'warning', 'error', 'critical']),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    component: z.string().optional(),
    timestamp: z.number().optional(),
  }),

  'system:maintenance': z.object({
    action: z.enum(['start', 'end', 'scheduled']),
    scheduledAt: z.number().optional(),
    duration: z.number().optional(),
    affectedServices: z.array(z.string()).optional(),
  }),

  'system:health': z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    services: z.record(
      z.object({
        status: z.enum(['up', 'down', 'degraded']),
        latencyMs: z.number().optional(),
      })
    ),
  }),

  // ==========================================================================
  // Notification Events (NEW)
  // ==========================================================================
  'notification:sent': z.object({
    notificationId: z.string(),
    userId: z.string(),
    type: z.enum(['email', 'sms', 'push', 'in-app']),
    delivered: z.boolean(),
  }),

  'notification:failed': z.object({
    notificationId: z.string(),
    userId: z.string(),
    type: z.string(),
    error: z.string(),
    willRetry: z.boolean(),
  }),
} as const;

export type PlaygroundEvents = typeof playgroundEvents;

// ==========================================================================
// Event Categories (for filtering/routing)
// ==========================================================================

export const eventCategories = {
  user: ['user:created', 'user:login', 'user:logout'],
  order: ['order:placed', 'order:shipped', 'order:delivered'],
  cache: ['cache:set', 'cache:delete', 'cache:invalidate', 'cache:hit', 'cache:miss'],
  queue: [
    'queue:job:added',
    'queue:job:started',
    'queue:job:completed',
    'queue:job:failed',
    'queue:job:progress',
  ],
  report: ['report:requested', 'report:generated'],
  system: ['system:alert', 'system:maintenance', 'system:health'],
  notification: ['notification:sent', 'notification:failed'],
} as const;

// ==========================================================================
// Helper: Get category for an event type
// ==========================================================================

export function getEventCategory(eventType: string): keyof typeof eventCategories | 'unknown' {
  for (const [category, events] of Object.entries(eventCategories)) {
    if ((events as readonly string[]).includes(eventType)) {
      return category as keyof typeof eventCategories;
    }
  }
  return 'unknown';
}
