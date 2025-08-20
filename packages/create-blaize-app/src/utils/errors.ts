import chalk from 'chalk';

/**
 * Custom error class for CLI operations
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Error code suggestions map
 */
const ERROR_SUGGESTIONS: Record<string, string> = {
  EACCES: 'Try running with sudo or check directory permissions',
  EEXIST: 'Choose a different name or remove the existing directory',
  ENOENT: 'Make sure the parent directory exists',
  ENOSPC: 'Free up disk space and try again',
  NETWORK_ERROR: 'Check your internet connection and try again',
  INVALID_NAME: 'Use only letters, numbers, hyphens, and underscores',
  VERSION_FETCH: 'Unable to fetch latest versions, using defaults',
  PERMISSION_DENIED: 'On Windows, try running as Administrator',
  MISSING_PROJECT_NAME: 'Please provide a project name: create-blaize-app <project-name>',
  INVALID_PACKAGE_MANAGER: 'Invalid package manager. Use: npm, pnpm, yarn, or bun',
  INSTALL_FAILED: 'Installation failed. Try running the install command manually',
  TEMPLATE_NOT_FOUND: 'Template not found. Available templates: minimal',
  NODE_VERSION: 'Node.js 23 or higher is required',
};

/**
 * Handle and display errors appropriately
 */
export const handleError = (error: unknown): never => {
  console.error(); // Empty line for spacing

  if (error instanceof CLIError) {
    console.error(chalk.red(`✖ ${error.message}`));

    if (error.suggestion) {
      console.log(chalk.yellow(`\n💡 ${error.suggestion}`));
    } else if (ERROR_SUGGESTIONS[error.code]) {
      console.log(chalk.yellow(`\n💡 ${ERROR_SUGGESTIONS[error.code]}`));
    }

    if (process.env.DEBUG) {
      console.error(chalk.gray('\nError details:'));
      console.error(chalk.gray(error.stack));
    }

    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    // Map Node.js errors to suggestions
    const errorCode = (error as any).code;

    if (errorCode && ERROR_SUGGESTIONS[errorCode]) {
      console.error(chalk.red(`✖ ${error.message}`));
      console.log(chalk.yellow(`\n💡 ${ERROR_SUGGESTIONS[errorCode]}`));
    } else if (error.message.includes('EACCES')) {
      console.error(chalk.red('✖ Permission denied'));
      console.log(chalk.yellow(`\n💡 ${ERROR_SUGGESTIONS.EACCES}`));
    } else if (error.message.includes('network')) {
      console.error(chalk.red('✖ Network error'));
      console.log(chalk.yellow(`\n💡 ${ERROR_SUGGESTIONS.NETWORK_ERROR}`));
    } else {
      console.error(chalk.red(`✖ ${error.message}`));
    }

    if (process.env.DEBUG) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    } else {
      console.log(chalk.gray('\nRun with DEBUG=1 for more information'));
    }

    process.exit(1);
  }

  // Unknown error
  console.error(chalk.red('✖ An unexpected error occurred'));
  console.log(chalk.yellow('💡 Try running with DEBUG=1 for more information'));

  if (process.env.DEBUG) {
    console.error(chalk.gray('\nError:'));
    console.error(error);
  }

  process.exit(1);
};

/**
 * Validate Node.js version
 */
export const validateNodeVersion = (): void => {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0]!.slice(1), 10);

  if (majorVersion < 23) {
    throw new CLIError(
      `Node.js 23 or higher is required (current: ${nodeVersion})`,
      'NODE_VERSION',
      'Please upgrade Node.js to version 23 or higher'
    );
  }
};
