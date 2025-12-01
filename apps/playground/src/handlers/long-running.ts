/**
 * Long-Running Job Handlers for SSE Testing
 *
 * These handlers take 10-30 seconds to complete,
 * giving you time to observe SSE progress updates.
 */

import type { JobContext } from '@blaizejs/plugin-queue';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Long-Running Handlers
// ============================================================================

interface LongReportData {
  reportType: string;
  includeCharts: boolean;
}

/**
 * Generate long report - 20 seconds with detailed progress
 */
export const generateLongReportHandler = async (
  ctx: JobContext<LongReportData>
): Promise<{ reportId: string; pages: number; duration: number }> => {
  const startTime = Date.now();
  const { reportType, includeCharts } = ctx.data;

  ctx.logger.info('Starting long report generation', { reportType });

  // Phase 1: Data collection (5 seconds)
  await ctx.progress(5, 'Collecting data from database');
  await sleep(2000);

  await ctx.progress(10, 'Processing 1000 records');
  await sleep(1000);

  await ctx.progress(15, 'Processing 2000 records');
  await sleep(1000);

  await ctx.progress(20, 'Processing complete - 3500 records');
  await sleep(1000);

  // Phase 2: Analysis (5 seconds)
  await ctx.progress(30, 'Running statistical analysis');
  await sleep(2000);

  await ctx.progress(40, 'Calculating trends');
  await sleep(1500);

  await ctx.progress(50, 'Generating insights');
  await sleep(1500);

  // Phase 3: Chart generation (5 seconds)
  if (includeCharts) {
    await ctx.progress(55, 'Creating line charts');
    await sleep(1500);

    await ctx.progress(60, 'Creating bar charts');
    await sleep(1500);

    await ctx.progress(65, 'Creating pie charts');
    await sleep(2000);
  }

  // Phase 4: PDF rendering (5 seconds)
  await ctx.progress(70, 'Rendering page 1 of 10');
  await sleep(500);

  await ctx.progress(75, 'Rendering page 3 of 10');
  await sleep(500);

  await ctx.progress(80, 'Rendering page 5 of 10');
  await sleep(1000);

  await ctx.progress(85, 'Rendering page 7 of 10');
  await sleep(1000);

  await ctx.progress(90, 'Rendering page 9 of 10');
  await sleep(1000);

  await ctx.progress(95, 'Finalizing PDF');
  await sleep(1000);

  await ctx.progress(100, 'Report complete');

  const duration = Date.now() - startTime;
  const reportId = `long-report-${Date.now()}`;

  ctx.logger.info('Long report completed', { reportId, duration });

  return {
    reportId,
    pages: 10,
    duration,
  };
};

interface VideoProcessingData {
  videoId: string;
  resolution: '720p' | '1080p' | '4k';
  duration: number; // seconds
}

/**
 * Process video - 30 seconds with very detailed progress
 */
export const processVideoHandler = async (
  ctx: JobContext<VideoProcessingData>
): Promise<{ videoId: string; outputUrl: string; processingTime: number }> => {
  const startTime = Date.now();
  const { videoId, resolution, duration } = ctx.data;

  ctx.logger.info('Starting video processing', { videoId, resolution, duration });

  // Phase 1: Upload & validation (3 seconds)
  await ctx.progress(2, 'Uploading video file');
  await sleep(1000);

  await ctx.progress(5, 'Validating video format');
  await sleep(1000);

  await ctx.progress(8, 'Checking video codec');
  await sleep(1000);

  // Phase 2: Transcoding (15 seconds)
  await ctx.progress(10, `Transcoding to ${resolution} - 0%`);
  await sleep(1500);

  await ctx.progress(20, `Transcoding to ${resolution} - 10%`);
  await sleep(1500);

  await ctx.progress(30, `Transcoding to ${resolution} - 25%`);
  await sleep(1500);

  await ctx.progress(40, `Transcoding to ${resolution} - 40%`);
  await sleep(1500);

  await ctx.progress(50, `Transcoding to ${resolution} - 55%`);
  await sleep(1500);

  await ctx.progress(60, `Transcoding to ${resolution} - 70%`);
  await sleep(1500);

  await ctx.progress(70, `Transcoding to ${resolution} - 85%`);
  await sleep(1500);

  await ctx.progress(75, `Transcoding to ${resolution} - 95%`);
  await sleep(1500);

  await ctx.progress(80, `Transcoding complete`);
  await sleep(1500);

  // Phase 3: Thumbnail generation (5 seconds)
  await ctx.progress(82, 'Generating thumbnails at 0:10');
  await sleep(1000);

  await ctx.progress(85, 'Generating thumbnails at 0:30');
  await sleep(1000);

  await ctx.progress(88, 'Generating thumbnails at 1:00');
  await sleep(1000);

  await ctx.progress(91, 'Creating preview sprite');
  await sleep(2000);

  // Phase 4: Upload to CDN (7 seconds)
  await ctx.progress(93, 'Uploading to CDN - 0%');
  await sleep(2000);

  await ctx.progress(96, 'Uploading to CDN - 50%');
  await sleep(2000);

  await ctx.progress(98, 'Uploading to CDN - 90%');
  await sleep(2000);

  await ctx.progress(100, 'Video processing complete');
  await sleep(1000);

  const processingTime = Date.now() - startTime;
  const outputUrl = `https://cdn.example.com/videos/${videoId}-${resolution}.mp4`;

  ctx.logger.info('Video processing completed', { videoId, outputUrl, processingTime });

  return {
    videoId,
    outputUrl,
    processingTime,
  };
};

interface DataMigrationData {
  fromDatabase: string;
  toDatabase: string;
  recordCount: number;
}

/**
 * Data migration - 25 seconds with progress per batch
 */
export const dataMigrationHandler = async (
  ctx: JobContext<DataMigrationData>
): Promise<{ migrated: number; failed: number; duration: number }> => {
  const startTime = Date.now();
  const { fromDatabase, toDatabase, recordCount } = ctx.data;

  ctx.logger.info('Starting data migration', { fromDatabase, toDatabase, recordCount });

  let migrated = 0;
  const batchSize = 1000;
  const totalBatches = Math.ceil(recordCount / batchSize);

  await ctx.progress(0, `Preparing to migrate ${recordCount} records in ${totalBatches} batches`);
  await sleep(2000);

  // Migrate in batches
  for (let batch = 1; batch <= totalBatches; batch++) {
    const recordsInBatch = Math.min(batchSize, recordCount - migrated);
    const percent = Math.floor((batch / totalBatches) * 95); // Save 5% for finalization

    await ctx.progress(
      percent,
      `Batch ${batch}/${totalBatches}: Migrating ${recordsInBatch} records`
    );

    // Simulate migration time
    await sleep(2000 + Math.random() * 1000);

    migrated += recordsInBatch;

    // Check for cancellation
    if (ctx.signal.aborted) {
      throw new Error('Migration cancelled');
    }
  }

  await ctx.progress(95, 'Verifying migrated data');
  await sleep(2000);

  await ctx.progress(98, 'Updating indexes');
  await sleep(1500);

  await ctx.progress(100, 'Migration complete');

  const duration = Date.now() - startTime;

  ctx.logger.info('Migration completed', { migrated, duration });

  return {
    migrated,
    failed: 0,
    duration,
  };
};
