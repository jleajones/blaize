import { z } from 'zod';

import { appRouter } from '../../../../app.js';

export const getPostById = appRouter.get({
  schema: {
    params: z.object({
      userId: z.string(),
      postId: z.string(),
    }),
    query: z.object({
      lastName: z.string().optional(),
    }),
    // Note: Response schema is not defined here becuase the handler returns HTML directly
  },
  handler: async (ctx, params) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><title>Welcome</title></head>
        <body><h1>List user ${params.userId} post ${params.postId}</h1></body>
      </html>
    `;
    ctx.response.html(htmlContent);
  },
});
