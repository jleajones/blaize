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

/**
 * Template file type
 */
export interface TemplateFile {
  path: string;
  content: string;
}

/**
 * Template type
 */
export interface Template {
  name: string;
  files: TemplateFile[];
  getDependencies: (options?: { latest?: boolean }) => Promise<Record<string, string>>;
  getDevDependencies: (options?: { latest?: boolean }) => Promise<Record<string, string>>;
  scripts: Record<string, string>;
}

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
