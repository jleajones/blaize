/**
 * Advanced Template
 *
 * Production-ready template with full plugin stack:
 * - Redis-backed EventBus
 * - Queue plugin with job handlers
 * - Cache plugin with TTL
 * - Metrics plugin (Prometheus)
 * - Security middleware
 * - Docker Compose setup
 * - Integration tests
 */

import { coreFiles } from './files/core';
import { healthMetricsRoutes, queueRoutes } from './files/routes';
import { scripts } from './scripts';
import { getDependencies, getDevDependencies } from '../../utils/versions';

import type { Template } from '@/types';

/**
 * Advanced template export
 */
export const advancedTemplate: Template = {
  name: 'advanced',
  files: [...coreFiles, ...healthMetricsRoutes, ...queueRoutes],
  scripts,
  getDependencies,
  getDevDependencies,
};
