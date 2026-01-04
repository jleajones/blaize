import { createContext } from '../context/create';
import { runWithContext } from '../context/store';
import { NotFoundError } from '../errors/not-found-error';
import { compose } from '../middleware/compose';
import { cors } from '../middleware/cors';
import { createErrorBoundary } from '../middleware/error-boundary/create';
import {
  createCorrelationIdFromHeaders,
  getCorrelationHeaderName,
  withCorrelationId,
} from '../tracing/correlation';

import type { Middleware } from '@blaize-types/middleware';
import type { RequestHandler, UnknownServer } from '@blaize-types/server';

export function createRequestHandler(serverInstance: UnknownServer): RequestHandler {
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
          bodyLimits: serverInstance.bodyLimits,
        });

        // Create request logger
        const requestLogger = serverInstance._logger.child({
          correlationId,
          method: context.request.method,
          path: context.request.path,
        });

        // Create error boundary middleware that catches all thrown error classes
        const errorBoundary = createErrorBoundary();
        const middlewareChain: Middleware[] = [errorBoundary];

        if ('corsOptions' in serverInstance && serverInstance.corsOptions !== false) {
          middlewareChain.push(cors(serverInstance.corsOptions));
        }

        // Compose all middleware with error boundary first (to catch all errors)
        middlewareChain.push(...serverInstance.middleware);

        // Compose all middleware into a single function
        const handler = compose(middlewareChain);
        const nextFn = async () => {
          if (!context.response.sent) {
            // Let the router handle the request
            await serverInstance.router.handleRequest(
              context,
              requestLogger,
              serverInstance.eventBus
            );
            // If router didn't handle it either, send a 404
            if (!res.headersSent && !context.response.sent) {
              throw new NotFoundError(
                `Route not found: ${context.request.method} ${context.request.path}`
              );
            }
          }
        };

        // Run the request with context in AsyncLocalStorage
        await runWithContext(context, async () => {
          await handler({
            ctx: context,
            next: nextFn,
            logger: requestLogger,
            eventBus: serverInstance.eventBus,
          });
        });
      });
    } catch (error) {
      // Fixed to handle HTTP/2 and check if headers already sent (SSE case)
      serverInstance._logger.error('Unhandled request error', { error, correlationId });
      const headerName = getCorrelationHeaderName();

      // Check if headers have already been sent (happens with SSE after stream starts)
      if (res.headersSent || (res as any).stream?.headersSent) {
        // Can't send HTTP error response after headers are sent
        // For SSE, the stream's error handling will take care of it
        serverInstance._logger.error('Headers already sent, cannot send error response');
        return;
      }

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
            message: 'An unexpected error occurred while processing the request',
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
            message: 'An unexpected error occurred while processing the request',
            correlationId,
          })
        );
      }
    }
  };
}
