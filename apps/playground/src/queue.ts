import { getQueueService, type InferQueueManifest } from '@blaizejs/plugin-queue';

import type { QueueConfig } from './queue-config';

/** Fully-typed queue manifest inferred from the playground's queue config */
export type AppQueueManifest = InferQueueManifest<QueueConfig>;

/** Get the typed queue service with full autocomplete for queue/job names and input data */
export const getQueue = () => getQueueService<AppQueueManifest>();

