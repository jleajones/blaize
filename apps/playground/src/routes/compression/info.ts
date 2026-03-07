/**
 * Compression Info Route
 *
 * GET /compression/info
 *
 * Returns information about available compression algorithms
 * and the current compression configuration.
 */
import { z } from 'zod';

import {
  detectAvailableAlgorithms,
  DEFAULT_ALGORITHMS,
} from '@blaizejs/middleware-compression';

import { appRouter } from '../../app-router';

export const GET = appRouter.get({
  schema: {
    response: z.object({
      message: z.string(),
      availableAlgorithms: z.array(z.string()),
      allAlgorithms: z.array(z.string()),
      nodeVersion: z.string(),
      routes: z.object({
        json: z.string(),
        stream: z.string(),
        info: z.string(),
      }),
      tips: z.array(z.string()),
    }),
  },
  handler: async ({ logger }) => {
    const allAlgorithms = [...DEFAULT_ALGORITHMS, 'identity'] as const;
    const available = detectAvailableAlgorithms(allAlgorithms);

    logger.info('Compression info requested', {
      available,
      nodeVersion: process.version,
    });

    return {
      message: '🗜️ Compression middleware info',
      availableAlgorithms: available,
      allAlgorithms: [...allAlgorithms],
      nodeVersion: process.version,
      routes: {
        json: 'GET /compression/json — Large JSON payload (>5KB)',
        stream: 'GET /compression/stream — NDJSON streaming with flush',
        info: 'GET /compression/info — This route',
      },
      tips: [
        '💡 Use Accept-Encoding header to request specific algorithms',
        '📊 curl -H "Accept-Encoding: gzip" http://localhost:7485/compression/json -v',
        '📊 curl -H "Accept-Encoding: br" http://localhost:7485/compression/json -v',
        '🔍 Check Content-Encoding response header to see which algorithm was used',
        '📦 Responses below 1KB threshold are not compressed',
      ],
    };
  },
});

