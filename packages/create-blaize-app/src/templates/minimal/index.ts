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

import { coreFiles } from './core';
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
  files: [
    ...coreFiles,
    // TODO: Add route files (T1.2-T1.5)
    // TODO: Add test files (T1.6)
    // TODO: Add config files (T1.7)
  ],
  scripts,
  getDependencies,
  getDevDependencies,
};
