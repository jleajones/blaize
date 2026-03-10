import { z } from 'zod';

import { appRouter } from '../app-router.js';

export const getRoot = appRouter.get({
  schema: {
    response: z.object({
      message: z.string(),
      docs: z.string(),
      endpoints: z.array(z.string()),
      timestamp: z.string(),
    }),
  },
  handler: async () => ({
    message: 'BlaizeJS API Demo',
    docs: 'https://blaizejs.dev',
    endpoints: [
      'GET  /',
      'GET  /health',
      'GET  /users',
      'POST /users',
      'GET  /users/:id',
      'GET  /sse/time',
    ],
    timestamp: new Date().toISOString(),
  }),
});
