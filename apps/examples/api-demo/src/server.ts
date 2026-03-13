import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Blaize } from 'blaizejs';

import { createCompressionMiddleware } from '@blaizejs/middleware-compression';
import { createSecurityMiddleware } from '@blaizejs/middleware-security';
import { createMetricsPlugin } from '@blaizejs/plugin-metrics';

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
const port = Number(process.env.PORT) || 7485;
const isProduction = process.env.NODE_ENV === 'production';

// ============================================================================
// Create and Start the Server
// ============================================================================

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export { port, isProduction };
