import { z } from 'zod';

import { appRouter } from '../app-router';

export const getHello = appRouter.get({
  schema: {
    response: z.object({
      name: z.string(),
    }),
  },
  handler: async ({ ctx, logger }) => {
    ctx.services.queue.add('emails', 'send', { to: 'testing@test.com', subject: 'Greeting', body: 'Hello from Blaize!' });
    logger.info('Handling hello route');
    return {
      name: 'Hi, it is Blaize and Bella!',
    };
  },
});

export const postHello = appRouter.post({
  schema: {
    response: z.object({
      message: z.string(),
    }),
    body: z.object({
      name: z.string(),
    }),
  },
  handler: async ({ ctx, params, logger }) => {
    logger.info('Handling hello POST route', params);
    ctx.services.queue.add('emails', 'send', { to: ctx.request.body.name, subject: 'Greeting', body: 'Hello from Blaize!' });
    return {
      message: `Hello, ${ctx.request.body.name} from Blaize and Bella and the hello route!`,
    };
  },
});
