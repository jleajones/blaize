import type { JobContext } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';
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
