import { createContext } from '../context/create';
import { runWithContext } from '../context/store';
import { NotFoundError } from '../errors/not-found-error';
import { compose } from '../middleware/compose';
import { createErrorBoundary } from '../middleware/error-boundary';
import {
  createCorrelationIdFromHeaders,
  getCorrelationHeaderName,
  withCorrelationId,
} from '../tracing/correlation';

import type { Server, RequestHandler } from '@blaize-types/server';

export function createRequestHandler(serverInstance: Server): RequestHandler {
  return async (req, res) => {
    const correlationId = createCorrelationIdFromHeaders(
      req.headers as Record<string, string | string[] | undefined>
    );

    try {
      await withCorrelationId(correlationId, async () => {
        // Create context for this request
        const context = await createContext(req, res, {
          parseBody: true, // Enable automatic body parsing
          initialState: {
            correlationId,
          },
        });

        // Create error boundary middleware that catches all thrown error classes
        const errorBoundary = createErrorBoundary();

        // Compose all middleware with error boundary first (to catch all errors)
        const allMiddleware = [errorBoundary, ...serverInstance.middleware];

        // Compose all middleware into a single function
        const handler = compose(allMiddleware);

        // Run the request with context in AsyncLocalStorage
        await runWithContext(context, async () => {
          await handler(context, async () => {
            if (!context.response.sent) {
              // Let the router handle the request
              await serverInstance.router.handleRequest(context);
              // If router didn't handle it either, send a 404
              if (!context.response.sent) {
                throw new NotFoundError(
                  `Route not found: ${context.request.method} ${context.request.path}`
                );
              }
            }
          });
        });
      });
    } catch (error) {
      // Fixed to handle HTTP/2
      console.error('Error creating context:', error);
      const headerName = getCorrelationHeaderName();

      if ('stream' in res && typeof (res as any).stream?.respond === 'function') {
        // HTTP/2
        (res as any).stream.respond({
          ':status': 500,
          'content-type': 'application/json',
          [headerName.toLowerCase()]: correlationId,
        });
        (res as any).stream.end(
          JSON.stringify({
            error: 'Internal Server Error',
            message: 'Failed to process request',
            correlationId,
          })
        );
      } else {
        // HTTP/1.1
        res.setHeader(headerName, correlationId);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Internal Server Error',
            message: 'Failed to process request',
            correlationId,
          })
        );
      }
    }
  };
}
