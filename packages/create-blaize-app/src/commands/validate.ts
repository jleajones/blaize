import path from 'node:path';

import fs from 'fs-extra';

import { type ParsedArgs } from './parse-args';
import { minimalTemplate, type Template } from '../templates/minimal';
import { CLIError } from '../utils/errors';
import { type Result, ok } from '../utils/functional';
import { detectPackageManager, type PackageManager } from '../utils/package-manager';

/**
 * Validated inputs type - contains everything needed for scaffolding
 */
export interface ValidatedInputs {
  // Original parsed args
  name: string;
  typescript: boolean;
  git: boolean;
  install: boolean;
  latest: boolean;
  dryRun: boolean;
  help: boolean;
  version: boolean;

  // Enhanced/resolved values
  projectPath: string;
  packageManager: PackageManager;
  template: Template;
}

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

  // Get template (for now, only minimal)
  const template = minimalTemplate;

  // Validate template exists
  if (args.template !== 'minimal') {
    throw new CLIError(
      `Template '${args.template}' not found`,
      'TEMPLATE_NOT_FOUND',
      'Available templates: minimal'
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
