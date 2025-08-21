import chalk from 'chalk';
import fs from 'fs-extra';

/**
 * Cleanup task type
 */
type CleanupTask = () => Promise<void> | void;

/**
 * Manages cleanup operations
 */
class CleanupManager {
  private cleanupTasks: CleanupTask[] = [];
  private isCleaningUp = false;

  /**
   * Register a cleanup task
   */
  register(task: CleanupTask): void {
    this.cleanupTasks.push(task);
  }

  /**
   * Remove all cleanup tasks
   */
  clear(): void {
    this.cleanupTasks = [];
  }

  /**
   * Execute all cleanup tasks
   */
  async cleanup(): Promise<void> {
    if (this.isCleaningUp || this.cleanupTasks.length === 0) return;
    this.isCleaningUp = true;

    console.log(chalk.yellow('\n🧹 Cleaning up...'));

    // Execute tasks in reverse order (LIFO)
    for (const task of this.cleanupTasks.reverse()) {
      try {
        await task();
      } catch (error) {
        // Log but don't throw during cleanup
        if (process.env.DEBUG) {
          console.error(chalk.gray('Cleanup error:'), error);
        }
      }
    }

    this.cleanupTasks = [];
    this.isCleaningUp = false;
  }
}

// Singleton instance
export const cleanupManager = new CleanupManager();

// Register signal handlers
const setupSignalHandlers = () => {
  // Skip signal handler registration in test environment
  // This prevents tests from triggering process.exit() calls
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return;
  }

  let signalHandled = false;

  const handleSignal = async (signal: string, exitCode: number) => {
    if (signalHandled) return;
    signalHandled = true;

    console.log(chalk.yellow(`\n\n⚠️  Process ${signal}`));
    await cleanupManager.cleanup();
    process.exit(exitCode);
  };

  process.on('SIGINT', () => handleSignal('interrupted', 130));
  process.on('SIGTERM', () => handleSignal('terminated', 143));

  process.on('uncaughtException', async error => {
    if (signalHandled) return;
    signalHandled = true;

    console.error(chalk.red('\n\n❌ Uncaught exception:'), error);
    try {
      await cleanupManager.cleanup();
    } catch (cleanupError) {
      console.error(chalk.red('Cleanup error:'), cleanupError);
    }
    process.exit(1);
  });

  process.on('unhandledRejection', async reason => {
    if (signalHandled) return;
    signalHandled = true;

    console.error(chalk.red('\n\n❌ Unhandled rejection:'), reason);
    try {
      await cleanupManager.cleanup();
    } catch (cleanupError) {
      console.error(chalk.red('Cleanup error:'), cleanupError);
    }
    process.exit(1);
  });
};

// Setup handlers on module load
setupSignalHandlers();

/**
 * Register cleanup for a directory
 */
export const registerDirectoryCleanup = (dirPath: string): void => {
  cleanupManager.register(async () => {
    if (await fs.pathExists(dirPath)) {
      console.log(chalk.gray(`  Removing ${dirPath}...`));
      await fs.remove(dirPath);
    }
  });
};

/**
 * Register cleanup for a file
 */
export const registerFileCleanup = (filePath: string): void => {
  cleanupManager.register(async () => {
    if (await fs.pathExists(filePath)) {
      console.log(chalk.gray(`  Removing ${filePath}...`));
      await fs.unlink(filePath);
    }
  });
};
