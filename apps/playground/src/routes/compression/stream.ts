/**
 * Compression Stream Demo Route
 *
 * GET /compression/stream
 *
 * Returns an NDJSON (newline-delimited JSON) stream to demonstrate
 * streaming compression with flush enabled.
 *
 * Uses route-level createCompressionMiddleware({ flush: true }) to ensure
 * each chunk is flushed through the compressor immediately. The
 * contentTypeFilter includes 'application/x-ndjson' so the NDJSON
 * content type is compressed even though it is not in the global
 * compressible-types list.
 */
import { Readable } from 'node:stream';

import { z } from 'zod';

import { createCompressionMiddleware } from '@blaizejs/middleware-compression';

import { appRouter } from '../../app-router';

/**
 * Generate NDJSON lines as a readable stream.
 * Each line is a JSON object followed by a newline.
 */
function createNDJSONStream(count: number): Readable {
  let index = 0;

  return new Readable({
    read() {
      if (index >= count) {
        this.push(null);
        return;
      }

      const record = {
        index: index + 1,
        timestamp: new Date().toISOString(),
        event: `event-${index + 1}`,
        data: {
          metric: Math.random() * 100,
          status: index % 3 === 0 ? 'warning' : 'ok',
          message: `Streaming record ${index + 1} of ${count}`,
          tags: ['compression', 'stream', 'ndjson'],
        },
      };

      this.push(JSON.stringify(record) + '\n');
      index++;
    },
  });
}

export const GET = appRouter.get({
  middleware: [
    createCompressionMiddleware({
      flush: true,
      contentTypeFilter: { include: ['application/x-ndjson'] },
    }),
  ],
  schema: {
    response: z.any(),
  },
  handler: async ({ ctx, logger }) => {
    const recordCount = 100;

    logger.info('Starting NDJSON stream for compression demo', {
      recordCount,
    });

    const stream = createNDJSONStream(recordCount);

    ctx.response.stream(stream, {
      contentType: 'application/x-ndjson',
      headers: {
        'X-Record-Count': String(recordCount),
        'X-Compression-Demo': 'streaming-with-flush',
      },
    });
  },
});

