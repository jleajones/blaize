import type { QueuePluginConfig } from '@blaizejs/plugin-queue';

import { RedisQueueAdapter } from '@blaizejs/adapter-redis';

import {
  dataSyncJob,
  generateReportJob,
  processImageJob,
  sendEmailJob,
  sendNotificationJob,
  unreliableTaskJob,
  verifyEmailJob,
  dataMigrationJob,
  generateLongReportJob,
  processVideoJob,
} from './handlers';

/**
 * Create the queue plugin configuration.
 *
 * Accepts the storage adapter at runtime (since it depends on Redis client)
 * and returns a config object with literal queue/job name types preserved
 * via `as const satisfies`.
 */
export function createQueueConfig(queueAdapter: RedisQueueAdapter) {
  return {
    storage: queueAdapter,
    serverId: 'playground-server-1',
    // Define queues with different configurations and job definitions
    queues: {
      // Email queue - medium concurrency, fast jobs
      emails: {
        concurrency: 5,
        defaultTimeout: 30000, // 30 seconds
        defaultMaxRetries: 3,
        jobs: {
          send: sendEmailJob,
          verify: verifyEmailJob,
        },
      },

      // Reports queue - low concurrency, long-running jobs
      reports: {
        concurrency: 2,
        defaultTimeout: 120000, // 2 minutes
        defaultMaxRetries: 1, // Don't retry expensive operations
        jobs: {
          generate: generateReportJob,
        },
      },

      // Processing queue - medium concurrency, variable duration
      processing: {
        concurrency: 3,
        defaultTimeout: 60000, // 1 minute
        defaultMaxRetries: 2,
        jobs: {
          image: processImageJob,
          'data-sync': dataSyncJob,
        },
      },

      // Notifications queue - high concurrency, quick jobs
      notifications: {
        concurrency: 10,
        defaultTimeout: 10000, // 10 seconds
        defaultMaxRetries: 5,
        jobs: {
          send: sendNotificationJob,
        },
      },

      // Testing queue - for unreliable tasks
      testing: {
        concurrency: 2,
        defaultTimeout: 30000,
        defaultMaxRetries: 3,
        jobs: {
          unreliable: unreliableTaskJob,
        },
      },
      longRunning: {
        concurrency: 2,
        defaultTimeout: 60000,
        defaultMaxRetries: 1,
        jobs: {
          'long-report': generateLongReportJob,
          video: processVideoJob,
          migration: dataMigrationJob,
        },
      },
    },

    // Global defaults
    defaultConcurrency: 5,
    defaultTimeout: 30000,
    defaultMaxRetries: 3,
  } as const satisfies QueuePluginConfig;
}

/** The type of the queue plugin config (with literal queue/job names preserved) */
export type QueueConfig = ReturnType<typeof createQueueConfig>;

