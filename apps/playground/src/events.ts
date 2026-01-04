import { z } from 'zod';

export const playgroundEvents = {
  // User events
  'user:created': z.object({
    userId: z.string(),
    email: z.string().email(),
    timestamp: z.number(),
  }),
  'user:login': z.object({
    userId: z.string(),
    ip: z.string().optional(),
  }),
  
  // Order events
  'order:placed': z.object({
    orderId: z.string(),
    userId: z.string(),
    total: z.number(),
    items: z.number(),
  }),
  'order:shipped': z.object({
    orderId: z.string(),
    trackingNumber: z.string(),
  }),
  
  // System events
  'system:alert': z.object({
    type: z.enum(['info', 'warning', 'error']),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  }),
} as const;

export type PlaygroundEvents = typeof playgroundEvents;