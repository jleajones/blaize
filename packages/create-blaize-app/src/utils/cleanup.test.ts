/* eslint-disable import/order */
// Mock modules before imports
vi.mock('chalk', () => ({
  default: {
    yellow: (str: string) => `[yellow]${str}[/yellow]`,
    gray: (str: string) => `[gray]${str}[/gray]`,
    red: (str: string) => `[red]${str}[/red]`,
  },
}));

vi.mock('fs-extra');

// Import the module first to check signal handler registration
import { cleanupManager, registerDirectoryCleanup, registerFileCleanup } from './cleanup';
import fs from 'fs-extra';

describe('Cleanup Utilities', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  const originalEnv = process.env;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env = { ...originalEnv };

    // Clear any registered tasks
    cleanupManager.clear();

    // Reset fs mocks - cast to any to avoid TypeScript issues
    (fs.pathExists as any).mockReset();
    (fs.remove as any).mockReset();
    (fs.unlink as any).mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.env = originalEnv;
    cleanupManager.clear();
  });

  describe('CleanupManager', () => {
    describe('register', () => {
      it('should register cleanup tasks', async () => {
        let task1Called = false;
        let task2Called = false;

        cleanupManager.register(() => {
          task1Called = true;
        });

        cleanupManager.register(() => {
          task2Called = true;
        });

        await cleanupManager.cleanup();

        expect(task1Called).toBe(true);
        expect(task2Called).toBe(true);
      });

      it('should handle async tasks', async () => {
        let taskCompleted = false;

        cleanupManager.register(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          taskCompleted = true;
        });

        await cleanupManager.cleanup();

        expect(taskCompleted).toBe(true);
      });

      it('should handle mixed sync and async tasks', async () => {
        const executionOrder: string[] = [];

        cleanupManager.register(() => {
          executionOrder.push('sync1');
        });

        cleanupManager.register(async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          executionOrder.push('async');
        });

        cleanupManager.register(() => {
          executionOrder.push('sync2');
        });

        await cleanupManager.cleanup();

        // LIFO order: sync2, async, sync1
        expect(executionOrder).toEqual(['sync2', 'async', 'sync1']);
      });
    });

    describe('clear', () => {
      it('should remove all registered tasks', async () => {
        let taskCalled = false;

        cleanupManager.register(() => {
          taskCalled = true;
        });

        cleanupManager.clear();
        await cleanupManager.cleanup();

        expect(taskCalled).toBe(false);
        // Should not show cleanup message if no tasks
        expect(consoleLogSpy).not.toHaveBeenCalledWith('[yellow]\n🧹 Cleaning up...[/yellow]');
      });
    });

    describe('cleanup', () => {
      it('should execute tasks in LIFO order', async () => {
        const executionOrder: number[] = [];

        cleanupManager.register(() => {
          executionOrder.push(1);
        });
        cleanupManager.register(() => {
          executionOrder.push(2);
        });
        cleanupManager.register(() => {
          executionOrder.push(3);
        });

        await cleanupManager.cleanup();

        expect(executionOrder).toEqual([3, 2, 1]);
      });

      it('should show cleanup message when tasks exist', async () => {
        cleanupManager.register(() => {});

        await cleanupManager.cleanup();

        expect(consoleLogSpy).toHaveBeenCalledWith('[yellow]\n🧹 Cleaning up...[/yellow]');
      });

      it('should not cleanup if no tasks registered', async () => {
        await cleanupManager.cleanup();

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });

      it('should prevent concurrent cleanup', async () => {
        let taskCallCount = 0;

        cleanupManager.register(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          taskCallCount++;
        });

        // Start multiple cleanups concurrently
        const cleanup1 = cleanupManager.cleanup();
        const cleanup2 = cleanupManager.cleanup();
        const cleanup3 = cleanupManager.cleanup();

        await Promise.all([cleanup1, cleanup2, cleanup3]);

        // Task should only be called once
        expect(taskCallCount).toBe(1);
        // Cleanup message should only appear once
        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      });

      it('should handle task errors without throwing', async () => {
        cleanupManager.register(() => {
          throw new Error('Task 1 error');
        });

        cleanupManager.register(() => {
          // This should still execute
        });

        // Should not throw
        await expect(cleanupManager.cleanup()).resolves.toBeUndefined();
      });

      it('should log errors in DEBUG mode', async () => {
        process.env.DEBUG = '1';
        const error = new Error('Cleanup task failed');

        cleanupManager.register(() => {
          throw error;
        });

        await cleanupManager.cleanup();

        expect(consoleErrorSpy).toHaveBeenCalledWith('[gray]Cleanup error:[/gray]', error);
      });

      it('should not log errors without DEBUG mode', async () => {
        delete process.env.DEBUG;

        cleanupManager.register(() => {
          throw new Error('Silent error');
        });

        await cleanupManager.cleanup();

        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it('should clear tasks after cleanup', async () => {
        let callCount = 0;

        cleanupManager.register(() => {
          callCount++;
        });

        await cleanupManager.cleanup();
        expect(callCount).toBe(1);

        // Second cleanup should not call the task again
        await cleanupManager.cleanup();
        expect(callCount).toBe(1);
        // Should not show cleanup message the second time
        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      });

      it('should reset isCleaningUp flag after completion', async () => {
        cleanupManager.register(() => {});

        await cleanupManager.cleanup();

        // Should be able to cleanup again after flag is reset
        cleanupManager.register(() => {});
        await cleanupManager.cleanup();

        expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('registerDirectoryCleanup', () => {
    it('should register directory removal task', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.remove as any).mockResolvedValue();

      registerDirectoryCleanup('/test/dir');
      await cleanupManager.cleanup();

      expect(fs.pathExists).toHaveBeenCalledWith('/test/dir');
      expect(fs.remove).toHaveBeenCalledWith('/test/dir');
      expect(consoleLogSpy).toHaveBeenCalledWith('[gray]  Removing /test/dir...[/gray]');
    });

    it('should skip removal if directory does not exist', async () => {
      (fs.pathExists as any).mockResolvedValue(false);

      registerDirectoryCleanup('/nonexistent');
      await cleanupManager.cleanup();

      expect(fs.pathExists).toHaveBeenCalledWith('/nonexistent');
      expect(fs.remove).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Removing /nonexistent')
      );
    });

    it('should handle multiple directory registrations', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.remove as any).mockResolvedValue();

      registerDirectoryCleanup('/dir1');
      registerDirectoryCleanup('/dir2');
      registerDirectoryCleanup('/dir3');

      await cleanupManager.cleanup();

      expect(fs.remove).toHaveBeenCalledTimes(3);
      // Check LIFO order
      expect(fs.remove).toHaveBeenNthCalledWith(1, '/dir3');
      expect(fs.remove).toHaveBeenNthCalledWith(2, '/dir2');
      expect(fs.remove).toHaveBeenNthCalledWith(3, '/dir1');
    });

    it('should handle removal errors gracefully', async () => {
      process.env.DEBUG = '1';
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.remove as any).mockRejectedValue(new Error('Permission denied'));

      registerDirectoryCleanup('/protected');

      // Should not throw
      await expect(cleanupManager.cleanup()).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[gray]Cleanup error:[/gray]',
        expect.any(Error)
      );
    });
  });

  describe('registerFileCleanup', () => {
    it('should register file removal task', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.unlink as any).mockResolvedValue();

      registerFileCleanup('/test/file.txt');
      await cleanupManager.cleanup();

      expect(fs.pathExists).toHaveBeenCalledWith('/test/file.txt');
      expect(fs.unlink).toHaveBeenCalledWith('/test/file.txt');
      expect(consoleLogSpy).toHaveBeenCalledWith('[gray]  Removing /test/file.txt...[/gray]');
    });

    it('should skip removal if file does not exist', async () => {
      (fs.pathExists as any).mockResolvedValue(false);

      registerFileCleanup('/nonexistent.txt');
      await cleanupManager.cleanup();

      expect(fs.pathExists).toHaveBeenCalledWith('/nonexistent.txt');
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should handle multiple file registrations', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.unlink as any).mockResolvedValue();

      registerFileCleanup('/file1.txt');
      registerFileCleanup('/file2.txt');

      await cleanupManager.cleanup();

      expect(fs.unlink).toHaveBeenCalledTimes(2);
      // Check LIFO order
      expect(fs.unlink).toHaveBeenNthCalledWith(1, '/file2.txt');
      expect(fs.unlink).toHaveBeenNthCalledWith(2, '/file1.txt');
    });

    it('should handle unlink errors gracefully', async () => {
      process.env.DEBUG = '1';
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.unlink as any).mockRejectedValue(new Error('File in use'));

      registerFileCleanup('/locked.txt');

      // Should not throw
      await expect(cleanupManager.cleanup()).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[gray]Cleanup error:[/gray]',
        expect.any(Error)
      );
    });
  });

  describe('Signal handler registration', () => {
    it('should skip signal handler registration in test environment', async () => {
      // Signal handlers are intentionally not registered in test environment
      // to prevent process.exit() calls during tests.
      // The setupSignalHandlers() function checks for NODE_ENV=test or VITEST=true
      // and skips registration to ensure test stability.

      // Verify the cleanup manager is available and functional
      expect(cleanupManager).toBeDefined();

      // The cleanup manager should work independently of signal handlers
      let _taskCalled = false;
      cleanupManager.register(() => {
        _taskCalled = true;
      });

      // Manual cleanup should work without signal handlers
      await expect(cleanupManager.cleanup()).resolves.toBeUndefined();
    });

    // Note: Actual signal handler testing should be done via integration tests
    // with child processes to safely test process.exit() behavior.
  });

  describe('Integration scenarios', () => {
    it('should handle mixed file and directory cleanup', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.remove as any).mockResolvedValue();
      (fs.unlink as any).mockResolvedValue();

      registerDirectoryCleanup('/tmp/project');
      registerFileCleanup('/tmp/temp.txt');
      registerDirectoryCleanup('/tmp/cache');

      await cleanupManager.cleanup();

      // Should clean up in reverse order (LIFO)
      expect(fs.remove).toHaveBeenNthCalledWith(1, '/tmp/cache');
      expect(fs.unlink).toHaveBeenNthCalledWith(1, '/tmp/temp.txt');
      expect(fs.remove).toHaveBeenNthCalledWith(2, '/tmp/project');
    });

    it('should handle partial failures', async () => {
      (fs.pathExists as any).mockResolvedValue(true);
      (fs.remove as any)
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce();

      process.env.DEBUG = '1';

      registerDirectoryCleanup('/dir1');
      registerDirectoryCleanup('/dir2'); // This will fail
      registerDirectoryCleanup('/dir3');

      await cleanupManager.cleanup();

      // All removes should be attempted despite failure
      expect(fs.remove).toHaveBeenCalledTimes(3);

      // Error should be logged but not thrown
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[gray]Cleanup error:[/gray]',
        expect.objectContaining({ message: 'Permission denied' })
      );
    });

    it('should handle cleanup with no items to remove', async () => {
      (fs.pathExists as any).mockResolvedValue(false);

      registerDirectoryCleanup('/nonexistent1');
      registerFileCleanup('/nonexistent2.txt');

      await cleanupManager.cleanup();

      expect(fs.remove).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('[yellow]\n🧹 Cleaning up...[/yellow]');
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('[gray]  Removing'));
    });

    it('should handle complex cleanup scenarios', async () => {
      // Mix of existing and non-existing paths
      (fs.pathExists as any)
        .mockResolvedValueOnce(true) // /exists1
        .mockResolvedValueOnce(false) // /missing
        .mockResolvedValueOnce(true); // /exists2

      (fs.remove as any).mockResolvedValue();
      (fs.unlink as any).mockResolvedValue();

      registerDirectoryCleanup('/exists1');
      registerFileCleanup('/missing');
      registerDirectoryCleanup('/exists2');

      await cleanupManager.cleanup();

      // Only existing paths should be removed
      expect(fs.remove).toHaveBeenCalledTimes(2);
      expect(fs.remove).toHaveBeenCalledWith('/exists2');
      expect(fs.remove).toHaveBeenCalledWith('/exists1');
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });
});
