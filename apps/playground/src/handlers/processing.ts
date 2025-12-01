import type { JobContext } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';
// ============================================================================
// Processing Queue Handlers
// ============================================================================

interface ProcessImageData {
  imageUrl: string;
  operations: ('resize' | 'compress' | 'watermark')[];
}

/**
 * Process image handler - Variable duration based on operations (2-5 seconds)
 */
export const processImageHandler = async (
  ctx: JobContext<ProcessImageData>
): Promise<{ processedUrl: string; operations: string[]; savings: string }> => {
  const { imageUrl, operations } = ctx.data;

  ctx.logger.info('Starting image processing', { imageUrl, operations });

  await ctx.progress(10, 'Loading image');
  await sleep(500);

  const completedOps: string[] = [];
  const totalOps = operations.length;
  let currentProgress = 10;

  for (let i = 0; i < operations.length; i++) {
    if (ctx.signal.aborted) throw new Error('Job cancelled');

    const op = operations[i];
    const progressIncrement = Math.floor(80 / totalOps);

    await ctx.progress(currentProgress + progressIncrement / 2, `Applying ${op}...`);
    await sleep(800 + Math.random() * 400);

    currentProgress += progressIncrement;
    await ctx.progress(currentProgress, `${op} complete`);

    completedOps.push(op!);
  }

  await ctx.progress(100, 'Image processing complete');

  const processedUrl = imageUrl.replace(/(\.\w+)$/, `-processed$1`);
  const savings = `${Math.floor(Math.random() * 40 + 20)}%`;

  ctx.logger.info('Image processed', { processedUrl, operations: completedOps });

  return { processedUrl, operations: completedOps, savings };
};

interface DataSyncData {
  source: string;
  destination: string;
  recordCount: number;
}

/**
 * Data sync handler - Long duration with many progress updates (8-12 seconds)
 */
export const dataSyncHandler = async (
  ctx: JobContext<DataSyncData>
): Promise<{ synced: number; failed: number; duration: number }> => {
  const { source, destination, recordCount } = ctx.data;
  const startTime = Date.now();

  ctx.logger.info('Starting data sync', { source, destination, recordCount });

  await ctx.progress(5, `Connecting to ${source}`);
  await sleep(500);

  await ctx.progress(10, `Connecting to ${destination}`);
  await sleep(500);

  // Simulate syncing records in batches
  const batchSize = Math.ceil(recordCount / 10);
  let synced = 0;
  let failed = 0;

  for (let batch = 0; batch < 10; batch++) {
    if (ctx.signal.aborted) throw new Error('Job cancelled');

    const batchStart = batch * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, recordCount);
    const progress = 10 + (batch + 1) * 8; // 10% to 90%

    await ctx.progress(progress, `Syncing records ${batchStart + 1}-${batchEnd}`);
    await sleep(800 + Math.random() * 400);

    // Simulate some failures
    const batchSuccess = batchSize - Math.floor(Math.random() * 3);
    synced += batchSuccess;
    failed += batchSize - batchSuccess;
  }

  await ctx.progress(95, 'Verifying sync integrity');
  await sleep(500);

  await ctx.progress(100, 'Sync complete');

  const duration = Date.now() - startTime;

  ctx.logger.info('Data sync complete', { synced, failed, duration });

  return { synced, failed, duration };
};
