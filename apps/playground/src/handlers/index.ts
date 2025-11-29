/**
 * Job Handlers for Queue Plugin Demo
 *
 * These handlers demonstrate different job types with varying durations
 * to allow testing SSE monitoring, dashboard, and status endpoints.
 */
import type { JobContext } from '@blaizejs/plugin-queue';

// ============================================================================
// Email Queue Handlers
// ============================================================================

interface SendEmailData {
  to: string;
  subject: string;
  body: string;
}

/**
 * Send email handler - Medium duration (2-3 seconds)
 * Simulates sending an email with progress updates
 */
export const sendEmailHandler = async (
  ctx: JobContext<SendEmailData>
): Promise<{ messageId: string; sentAt: number }> => {
  const { to, subject } = ctx.data;

  ctx.logger.info('Starting email send', { to, subject });

  // Step 1: Validate
  await ctx.progress(10, 'Validating recipient');
  await sleep(300);

  if (ctx.signal.aborted) throw new Error('Job cancelled');

  // Step 2: Prepare
  await ctx.progress(30, 'Preparing email content');
  await sleep(500);

  if (ctx.signal.aborted) throw new Error('Job cancelled');

  // Step 3: Connect to SMTP
  await ctx.progress(50, 'Connecting to mail server');
  await sleep(400);

  if (ctx.signal.aborted) throw new Error('Job cancelled');

  // Step 4: Send
  await ctx.progress(80, 'Sending email');
  await sleep(600);

  // Step 5: Verify
  await ctx.progress(100, 'Email sent successfully');

  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  ctx.logger.info('Email sent', { messageId, to });

  return { messageId, sentAt: Date.now() };
};

interface VerifyEmailData {
  email: string;
}

/**
 * Verify email handler - Short duration (0.5-1 second)
 */
export const verifyEmailHandler = async (
  ctx: JobContext<VerifyEmailData>
): Promise<{ email: string; isValid: boolean; provider: string }> => {
  const { email } = ctx.data;

  ctx.logger.info('Verifying email', { email });

  await ctx.progress(30, 'Checking format');
  await sleep(200);

  await ctx.progress(60, 'Looking up MX records');
  await sleep(300);

  await ctx.progress(100, 'Verification complete');

  // Simulate validation
  const isValid = email.includes('@') && email.includes('.');
  const provider = email.split('@')[1] || 'unknown';

  return { email, isValid, provider };
};

// ============================================================================
// Report Queue Handlers
// ============================================================================

interface GenerateReportData {
  reportType: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
}

/**
 * Generate report handler - Long duration (5-8 seconds)
 * Simulates a heavy report generation task
 */
export const generateReportHandler = async (
  ctx: JobContext<GenerateReportData>
): Promise<{ reportId: string; pages: number; size: string }> => {
  const { reportType, startDate, endDate } = ctx.data;

  ctx.logger.info('Starting report generation', { reportType, startDate, endDate });

  const steps = [
    { progress: 5, message: 'Initializing report engine' },
    { progress: 15, message: 'Fetching data from database' },
    { progress: 30, message: 'Processing transactions' },
    { progress: 45, message: 'Calculating metrics' },
    { progress: 60, message: 'Generating charts' },
    { progress: 75, message: 'Formatting tables' },
    { progress: 85, message: 'Compiling PDF' },
    { progress: 95, message: 'Finalizing report' },
    { progress: 100, message: 'Report complete' },
  ];

  for (const step of steps) {
    if (ctx.signal.aborted) {
      ctx.logger.warn('Report generation cancelled');
      throw new Error('Job cancelled');
    }

    await ctx.progress(step.progress, step.message);
    await sleep(600 + Math.random() * 400); // 600-1000ms per step
  }

  const reportId = `RPT-${reportType.toUpperCase()}-${Date.now()}`;
  const pages = Math.floor(Math.random() * 50) + 10;

  ctx.logger.info('Report generated', { reportId, pages });

  return {
    reportId,
    pages,
    size: `${(pages * 0.3).toFixed(1)} MB`,
  };
};

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

// ============================================================================
// Notification Queue Handlers
// ============================================================================

interface SendNotificationData {
  userId: string;
  type: 'push' | 'sms' | 'in-app';
  message: string;
}

/**
 * Send notification handler - Quick (0.5-1 second)
 */
export const sendNotificationHandler = async (
  ctx: JobContext<SendNotificationData>
): Promise<{ notificationId: string; delivered: boolean }> => {
  const { userId, type } = ctx.data;

  ctx.logger.info('Sending notification', { userId, type });

  await ctx.progress(30, `Preparing ${type} notification`);
  await sleep(200);

  await ctx.progress(70, 'Delivering notification');
  await sleep(300 + Math.random() * 200);

  await ctx.progress(100, 'Notification sent');

  const notificationId = `notif-${Date.now()}-${userId}`;
  const delivered = Math.random() > 0.1; // 90% success rate

  ctx.logger.info('Notification result', { notificationId, delivered });

  return { notificationId, delivered };
};

// ============================================================================
// Failing Job Handler (for testing error handling)
// ============================================================================

interface UnreliableTaskData {
  taskId: string;
  failureRate: number; // 0-1
}

/**
 * Unreliable task handler - May fail randomly (for testing retries)
 */
export const unreliableTaskHandler = async (
  ctx: JobContext<UnreliableTaskData>
): Promise<{ taskId: string; attempt: number }> => {
  const { taskId, failureRate } = ctx.data;

  ctx.logger.info('Starting unreliable task', { taskId, failureRate });

  await ctx.progress(25, 'Phase 1');
  await sleep(300);

  await ctx.progress(50, 'Phase 2');
  await sleep(300);

  // Random failure based on failure rate
  if (Math.random() < failureRate) {
    ctx.logger.error('Task failed randomly', { taskId });
    throw new Error(`Random failure for task ${taskId}`);
  }

  await ctx.progress(75, 'Phase 3');
  await sleep(300);

  await ctx.progress(100, 'Complete');

  return { taskId, attempt: 1 };
};

// ============================================================================
// Utility
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
