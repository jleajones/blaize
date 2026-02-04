/**
 * Minimal Template
 *
 * Enhanced learning template with core BlaizeJS features:
 * - File-based routing
 * - Type-safe file uploads
 * - SSE streaming
 * - EventBus integration
 * - Comprehensive test suite
 */

import { configFiles } from './files/config';
import { coreFiles } from './files/core';
import { routeFiles } from './files/routes';
import { testFiles } from './files/tests';
import { scripts } from './scripts';
import { getDependencies, getDevDependencies } from '../../utils/versions';

import type { Template } from '@/types';

/**
 * Minimal template export
 */
export const minimalTemplate: Template = {
  name: 'minimal',
  files: [...coreFiles, ...routeFiles, ...testFiles, ...configFiles],
  scripts,
  getDependencies,
  getDevDependencies,
};
