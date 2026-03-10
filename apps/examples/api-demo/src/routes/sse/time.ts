import { z } from 'zod';

import { appRouter } from '../../app-router.js';

// GET /sse/time
// Streams the current server time every second.
// No Redis, no queue — just a ticker. Shows SSE works out of the box.
//
// Test with:
//   curl -N https://your-app.railway.app/sse/time
export const getSseTime = appRouter.sse({
  schema: {
    events: {
      connected: z.object({
        message: z.string(),
        timestamp: z.string(),
      }),
      tick: z.object({
        tick: z.number(),
        time: z.string(),
        uptime: z.number(),
      }),
      done: z.object({
        message: z.string(),
      }),
    },
  },
  handler: async ({ stream, logger }) => {
    let ticks = 0;

    logger.info('SSE /sse/time connection opened');

    // Send an immediate "connected" event so the client knows it's live
    stream.send('connected', {
      message: 'SSE stream connected',
      timestamp: new Date().toISOString(),
    });

    const interval = setInterval(() => {
      ticks++;
      stream.send('tick', {
        tick: ticks,
        time: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });

      // Auto-close after 60 ticks so we don't leak connections in the demo
      if (ticks >= 60) {
        stream.send('done', { message: 'Stream ended after 60 ticks' });
        clearInterval(interval);
        stream.close();
      }
    }, 1000);

    // Cleanup if the client disconnects early
    stream.onClose(() => {
      clearInterval(interval);
      logger.info('SSE /sse/time connection closed');
    });
  },
});
