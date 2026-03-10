import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Blaize } from 'blaizejs';

import { createCompressionMiddleware } from '@blaizejs/middleware-compression';
import { createSecurityMiddleware } from '@blaizejs/middleware-security';
import { createMetricsPlugin } from '@blaizejs/plugin-metrics';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===========================================================================
// Metrics Plugin
// ===========================================================================
const metricsPlugin = createMetricsPlugin({
  enabled: true,
  excludePaths: ['/health', '/favicon.ico'], // Don't track health checks
  histogramLimit: 1000,
  collectionInterval: 60000, // Report every 60 seconds
  maxCardinality: 10,
  onCardinalityLimit: 'warn',
  labels: {
    service: 'playground-app',
    environment: process.env.NODE_ENV || 'development',
    redis: 'enabled',
  },
});

// ============================================================================
// Security Middleware
// ============================================================================
const securityMiddleware = createSecurityMiddleware();

// ============================================================================
// Compression Middleware
// ============================================================================
const compressionMiddleware = createCompressionMiddleware();

// ---------------------------------------------------------------------------
// Railway (and most PaaS) terminates TLS at the edge.
// The app receives plain HTTP/1.1, so HTTP/2 must be disabled.
// PORT is injected by Railway at runtime.
// ---------------------------------------------------------------------------
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 7480;
const isProduction = process.env.NODE_ENV === 'production';

// ============================================================================
// Create and Start the Server
// ============================================================================
export const server = Blaize.createServer({
  port,
  host: '0.0.0.0',
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: !isProduction,
  },
  middleware: [
    compressionMiddleware,
    securityMiddleware,
    Blaize.Middleware.requestLoggerMiddleware({
      includeHeaders: true,
      headerWhitelist: ['content-type', 'authorization', 'cookie'],
    }),
  ],
  plugins: [metricsPlugin] as const,
});

Blaize.logger.info('✅ EventBus Redis adapter configured');

try {
  Blaize.logger.info(path.resolve(__dirname, './routes'));
  // Create the server instance

  // Start the server
  await server.listen();

  Blaize.logger.info('🚀 API Demo server ready!');
  Blaize.logger.info('');
  Blaize.logger.info('📖 Try these demos:');
  Blaize.logger.info('   Root: GET  http://localhost:7485');
  Blaize.logger.info('   Health: GET  http://localhost:7485/health');
  Blaize.logger.info('   Users: GET  http://localhost:7485/users');
  Blaize.logger.info('   Create User: POST  http://localhost:7485/users');
  Blaize.logger.info('   Get User by ID: GET  http://localhost:7485/users/:id');
  Blaize.logger.info('   SSE Time: GET  http://localhost:7485/sse/time');
  Blaize.logger.info('');

  // Handle process termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      Blaize.logger.info(`🔥 Received ${signal}, shutting down server...`);
      try {
        await server.close();
        Blaize.logger.info('🚪 Server shutdown completed, exiting.');
        process.exit(0);
      } catch (error) {
        Blaize.logger.error('❌ Error during shutdown:', { error });
        process.exit(1);
      }
    });
  });
} catch (err) {
  Blaize.logger.error('❌ Error:', { error: err });
}
