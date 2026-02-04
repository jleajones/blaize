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
      const child = spawn(cmd, args, {
        cwd: projectPath,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      // Handle interruption
      const handleInterrupt = () => {
        child.kill('SIGINT');
        spinner.fail('Installation interrupted');
        process.exit(130);
      };

      process.once('SIGINT', handleInterrupt);

      child.on('exit', code => {
        // Cleanup SIGINT handler
        process.removeListener('SIGINT', handleInterrupt);

        // Resolve or reject based on exit code
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Installation failed with exit code ${code}`));
        }
      });

      child.on('error', (err: Error) => {
        process.removeListener('SIGINT', handleInterrupt);
        reject(err);
      });
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    spinner.succeed(chalk.green(`✓ Dependencies installed in ${duration}s`));

    return ok({
      ...context,
      installSkipped: false,
      installDuration: parseFloat(duration),
    });
  } catch {
    spinner.fail(chalk.red('✖ Installation failed'));
    console.log(
      chalk.yellow(
        `\n💡 You can try installing manually: cd ${context.name} && ${packageManager} install`
      )
    );

    // Don't fail the entire process - user can install manually
    return ok({
      ...context,
      installSkipped: true,
    });
  }
};
