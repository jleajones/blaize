import path from 'node:path';

import chalk from 'chalk';
import fs from 'fs-extra';

import {
  generateTsConfig,
  generateGitIgnore,
  generateReadme,
  generatePackageJson,
} from '../templates/generators';
import { registerDirectoryCleanup } from '../utils/cleanup';
import { ok } from '../utils/functional';

import type { Result, ScaffoldResult, ValidatedInputs } from '@/types';

/**
 * Process template variables
 */
function processTemplate(content: string, variables: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

/**
 * Initialize git repository
 */
async function initGit(projectPath: string): Promise<void> {
  const { spawn } = await import('node:child_process');

  return new Promise(resolve => {
    const child = spawn('git', ['init'], {
      cwd: projectPath,
      stdio: 'pipe',
    });

    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        // Git init failure is not critical
        console.warn(chalk.yellow('⚠️  Git initialization failed'));
        resolve();
      }
    });

    child.on('error', () => {
      // Git not installed or other error - not critical
      console.warn(chalk.yellow('⚠️  Git initialization skipped'));
      resolve();
    });
  });
}

/**
 * Scaffold the project
 */
export const scaffold = async (inputs: ValidatedInputs): Promise<Result<ScaffoldResult, Error>> => {
  const { projectPath, name, packageManager, template, dryRun, git, latest } = inputs;

  if (dryRun) {
    console.log(chalk.blue('🔍 Dry run mode - no files will be created'));
  }

  // Register cleanup in case of failure
  if (!dryRun) {
    registerDirectoryCleanup(projectPath);
  }

  const filesCreated: string[] = [];

  // Create project directory
  if (!dryRun) {
    await fs.ensureDir(projectPath);
    console.log(chalk.green(`✓ Created project directory: ${name}`));
  }

  // Process and write template files
  for (const file of template.files) {
    const filePath = path.join(projectPath, file.path);
    const content = processTemplate(file.content, {
      projectName: name,
      packageManager,
    });

    if (!dryRun) {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content, 'utf-8');
    }

    filesCreated.push(file.path);
  }

  // Generate configuration files
  const configs = [
    { path: 'tsconfig.json', content: generateTsConfig() },
    // { path: 'vitest.config.ts', content: generateVitestConfig() },
    { path: '.gitignore', content: generateGitIgnore() },
    { path: 'README.md', content: generateReadme(name, packageManager) },
  ];

  for (const config of configs) {
    const filePath = path.join(projectPath, config.path);

    if (!dryRun) {
      await fs.writeFile(filePath, config.content, 'utf-8');
    }

    filesCreated.push(config.path);
  }

  // Create package.json - pass latest as a non-optional boolean
  const packageJson = await generatePackageJson(name, template, latest);

  if (!dryRun) {
    await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });
  }

  filesCreated.push('package.json');

  console.log(chalk.green(`✓ Generated ${filesCreated.length} files`));

  // Initialize git if requested
  if (git && !dryRun) {
    await initGit(projectPath);
    console.log(chalk.green('✓ Initialized git repository'));
  }

  return ok({
    ...inputs,
    filesCreated,
  });
};
