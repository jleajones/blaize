import { spawn } from 'node:child_process';

import chalk from 'chalk';
import ora from 'ora';

import { ok } from '../utils/functional';
import { getInstallCommand } from '../utils/package-manager';

import type { InstallResult, Result, ScaffoldResult } from '@/types';

/**
 * Install dependencies
 */
export const install = async (context: ScaffoldResult): Promise<Result<InstallResult, Error>> => {
  const { projectPath, packageManager, install: shouldInstall, dryRun } = context;

  // Skip if not installing or in dry-run mode
  if (!shouldInstall || dryRun) {
    console.log(chalk.yellow('⚠️  Skipping dependency installation'));
    return ok({
      ...context,
      installSkipped: true,
    });
  }

  const spinner = ora({
    text: 'Installing dependencies...',
    color: 'cyan',
  }).start();

  const startTime = Date.now();

  try {
    const installCmd = getInstallCommand(packageManager);
    const [cmd, ...args] = installCmd;

    if (!cmd) {
      throw new Error('Invalid package manager command');
    }

    await new Promise<void>((resolve, reject) => {
      // Explicitly type the stdio option to avoid type conflicts
      const isDebug = process.env.DEBUG === 'true';

      const child = isDebug
        ? spawn(cmd, args, {
            cwd: projectPath,
            stdio: 'inherit',
            shell: process.platform === 'win32',
          })
        : spawn(cmd, args, {
            cwd: projectPath,
            stdio: ['inherit', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
          });

      let errorOutput = '';

      // Only access stderr when stdio is 'pipe'
      if (!isDebug && 'stderr' in child && child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
      }

      child.on('exit', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(errorOutput || `Installation failed with code ${code}`));
        }
      });

      child.on('error', (err: Error) => {
        reject(err);
      });

      // Handle interruption
      const handleInterrupt = () => {
        child.kill('SIGINT');
        spinner.fail('Installation interrupted');
        process.exit(130);
      };

      process.once('SIGINT', handleInterrupt);

      // Clean up handler when child exits
      child.on('exit', () => {
        process.removeListener('SIGINT', handleInterrupt);
      });
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    spinner.succeed(chalk.green(`✓ Dependencies installed in ${duration}s`));

    return ok({
      ...context,
      installSkipped: false,
      installDuration: parseFloat(duration),
    });
  } catch (error) {
    spinner.fail(chalk.red('✖ Installation failed'));

    // Provide recovery suggestions based on error
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
      console.log(chalk.yellow('\n💡 Try clearing npm cache: npm cache clean --force'));
      console.log(chalk.yellow('   Or run with different permissions'));
    } else if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
      console.log(chalk.yellow('\n💡 Check your internet connection and try again'));
      console.log(
        chalk.yellow(`   You can also run: cd ${context.name} && ${packageManager} install`)
      );
    } else if (errorMessage.includes('ENOSPC')) {
      console.log(chalk.yellow('\n💡 Not enough disk space. Free up some space and try again'));
    } else {
      console.log(
        chalk.yellow(
          `\n💡 You can try installing manually: cd ${context.name} && ${packageManager} install`
        )
      );
    }

    // Don't fail the entire process - user can install manually
    return ok({
      ...context,
      installSkipped: true,
    });
  }
};
