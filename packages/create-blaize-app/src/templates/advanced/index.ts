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

import { configFiles } from './files/config';
import { coreFiles } from './files/core';
import { routeFiles } from './files/routes';
import { testFiles } from './files/tests';
import { scripts } from './scripts';
import { getDependencies, getDevDependencies } from '../../utils/versions';

import type { Template } from '@/types';

/**
 * Advanced template export
 */
export const advancedTemplate: Template = {
  name: 'advanced',
  files: [...coreFiles, ...routeFiles, ...testFiles, ...configFiles],
  scripts,
  getDependencies,
  getDevDependencies,
};
