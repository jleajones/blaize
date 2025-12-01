import type { JobContext } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

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
