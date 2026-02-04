import path from 'node:path';

import fs from 'fs-extra';

import { advancedTemplate } from '../templates/advanced';
import { minimalTemplate } from '../templates/minimal';
import { CLIError } from '../utils/errors';
import { ok } from '../utils/functional';
import { detectPackageManager } from '../utils/package-manager';

import type { ParsedArgs, Result, Template, ValidatedInputs } from '@/types';

/**
 * Template registry
 */
const templates: Record<string, Template> = {
  minimal: minimalTemplate,
  advanced: advancedTemplate,
};

/**
 * Validate and prepare inputs
 */
export const validateInputs = async (args: ParsedArgs): Promise<Result<ValidatedInputs, Error>> => {
  const projectPath = path.resolve(process.cwd(), args.name);

  // Check if file or directory already exists (unless dry-run)
  if (!args.dryRun && (await fs.pathExists(projectPath))) {
    const stats = await fs.stat(projectPath);
    if (stats.isDirectory()) {
      const files = await fs.readdir(projectPath);
      if (files.length > 0) {
        throw new CLIError(
          `Directory ${args.name} already exists and is not empty`,
          'EEXIST',
          'Choose a different name or remove the existing directory'
        );
      }
    } else {
      // Handle the case where a file exists at the target path
      throw new CLIError(
        `A file already exists at ${args.name}`,
        'EEXIST',
        'Choose a different name or remove the existing file'
      );
    }
  }

  // Detect or use specified package manager
  const packageManager = args.packageManager || detectPackageManager();

  // Get template from registry
  const template = templates[args.template];

  // Validate template exists
  if (!template) {
    throw new CLIError(
      `Template '${args.template}' not found`,
      'TEMPLATE_NOT_FOUND',
      `Available templates: ${Object.keys(templates).join(', ')}`
    );
  }

  return ok({
    // Spread the original args (except template and packageManager which we're replacing)
    name: args.name,
    typescript: args.typescript,
    git: args.git,
    install: args.install,
    latest: args.latest,
    dryRun: args.dryRun,
    help: args.help,
    version: args.version,

    // Add enhanced values
    projectPath,
    packageManager,
    template,
  });
};
