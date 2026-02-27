import { z } from 'zod';

import { defineJob } from '@blaizejs/plugin-queue';

import { sleep } from './utilities';

// ============================================================================
// Email Queue Handlers
// ============================================================================

/**
 * Send email handler - Medium duration (2-3 seconds)
 * Simulates sending an email with progress updates
 */
export const sendEmailJob = defineJob({
  input: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  output: z.object({
    messageId: z.string(),
    sentAt: z.number(),
  }),
  handler: async (ctx) => {
    const { logger, progress, signal } = ctx;
    const { to, subject } = ctx.data;

    logger.info('Starting email send', { to, subject });

    // Step 1: Validate
    await progress(10, 'Validating recipient');
    await sleep(300);

    if (signal.aborted) throw new Error('Job cancelled');

    // Step 2: Prepare
    await progress(30, 'Preparing email content');
    await sleep(500);

    if (signal.aborted) throw new Error('Job cancelled');

    // Step 3: Connect to SMTP
    await progress(50, 'Connecting to mail server');
    await sleep(400);

    if (signal.aborted) throw new Error('Job cancelled');

    // Step 4: Send
    await progress(80, 'Sending email');
    await sleep(600);

    // Step 5: Verify
    await progress(100, 'Email sent successfully');
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.info('Email sent', { messageId, to });

    return { messageId, sentAt: Date.now() };
  },
});

/**
 * Verify email handler - Short duration (0.5-1 second)
 */
export const verifyEmailJob = defineJob({
  input: z.object({
    email: z.string(),
  }),
  output: z.object({
    email: z.string(),
    isValid: z.boolean(),
    provider: z.string(),
  }),
  handler: async (ctx) => {
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
  },
});
