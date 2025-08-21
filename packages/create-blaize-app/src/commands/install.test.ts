import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

import ora from 'ora';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { install } from './install';
import { getInstallCommand } from '../utils/package-manager';

import type { ScaffoldResult } from './scaffold';
import type { Template } from '../templates/minimal';

// Mock template object that implements the Template interface
const mockTemplate: Template = {
  name: 'minimal',
  files: [],
  getDependencies: vi.fn().mockResolvedValue({}),
  getDevDependencies: vi.fn().mockResolvedValue({}),
  scripts: {},
};

// Helper function to create a valid ScaffoldResult with all required properties
const createMockContext = (overrides: Partial<ScaffoldResult> = {}): ScaffoldResult => ({
  name: 'test-app',
  projectPath: '/path/to/test-app',
  packageManager: 'npm',
  install: true,
  git: true,
  latest: false,
  dryRun: false,
  typescript: true,
  template: mockTemplate,
  filesCreated: [],
  help: false,
  version: false,
  ...overrides,
});

// Mock all external dependencies
vi.mock('node:child_process');
vi.mock('chalk', () => ({
  default: {
    yellow: vi.fn((str: string) => str),
    green: vi.fn((str: string) => str),
    red: vi.fn((str: string) => str),
  },
}));
vi.mock('ora');
vi.mock('../utils/package-manager');

describe('install', () => {
  let mockSpinner: any;
  let mockChildProcess: any;
  let consoleLogSpy: any;
  let processExitSpy: any;
  let processOnceSpy: any;
  let processRemoveListenerSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock spinner
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
    };
    (ora as any).mockReturnValue(mockSpinner);

    // Create mock child process
    mockChildProcess = new EventEmitter() as any;
    mockChildProcess.kill = vi.fn();
    mockChildProcess.stderr = new EventEmitter();

    // Mock spawn to return our mock child process
    (spawn as any).mockReturnValue(mockChildProcess);

    // Mock getInstallCommand
    (getInstallCommand as any).mockReturnValue(['npm', 'install']);

    // Spy on console and process methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    processOnceSpy = vi.spyOn(process, 'once');
    processRemoveListenerSpy = vi.spyOn(process, 'removeListener');

    // Reset environment
    delete process.env.DEBUG;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    processOnceSpy.mockRestore();
    processRemoveListenerSpy.mockRestore();
  });

  describe('skip conditions', () => {
    it('should skip installation when install flag is false', async () => {
      const context: ScaffoldResult = createMockContext({ install: false });

      const result = await install(context);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.installSkipped).toBe(true);
      expect(spawn).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️  Skipping dependency installation');
    });

    it('should skip installation in dry-run mode', async () => {
      const context: ScaffoldResult = createMockContext({ dryRun: true });

      const result = await install(context);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.installSkipped).toBe(true);
      expect(spawn).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️  Skipping dependency installation');
    });
  });

  describe('successful installation', () => {
    it('should install dependencies successfully', async () => {
      const context: ScaffoldResult = createMockContext();

      // Start the install
      const installPromise = install(context);

      // Simulate successful installation
      setTimeout(() => {
        mockChildProcess.emit('exit', 0);
      }, 50);

      const result = await installPromise;

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.installSkipped).toBe(false);
      expect(result.value.installDuration).toBeDefined();
      expect(result.value.installDuration).toBeGreaterThan(0);

      expect(spawn).toHaveBeenCalledWith('npm', ['install'], {
        cwd: '/path/to/test-app',
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('✓ Dependencies installed')
      );
    });

    it('should use correct package manager commands', async () => {
      const packageManagers = [
        { name: 'npm', command: ['npm', 'install'] },
        { name: 'pnpm', command: ['pnpm', 'install'] },
        { name: 'yarn', command: ['yarn'] },
        { name: 'bun', command: ['bun', 'install'] },
      ];

      for (const pm of packageManagers) {
        vi.clearAllMocks();
        (getInstallCommand as any).mockReturnValue(pm.command);

        const context: ScaffoldResult = createMockContext({
          packageManager: pm.name as any,
        });

        const installPromise = install(context);

        process.nextTick(() => {
          mockChildProcess.emit('exit', 0);
        });

        const result = await installPromise;

        expect(result.ok).toBe(true);
        expect(getInstallCommand).toHaveBeenCalledWith(pm.name);
        expect(spawn).toHaveBeenCalledWith(pm.command[0], pm.command.slice(1), expect.any(Object));
      }
    });

    it('should use inherit stdio in debug mode', async () => {
      process.env.DEBUG = 'true';

      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      process.nextTick(() => {
        mockChildProcess.emit('exit', 0);
      });

      await installPromise;

      expect(spawn).toHaveBeenCalledWith('npm', ['install'], {
        cwd: '/path/to/test-app',
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });
    });
  });

  describe('error handling', () => {
    it('should handle installation failure with non-zero exit code', async () => {
      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      // Simulate stderr output and failure
      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Error: Package not found'));
        mockChildProcess.emit('exit', 1);
      });

      const result = await installPromise;

      expect(result.ok).toBe(true); // Install doesn't fail the whole process
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.installSkipped).toBe(true);
      expect(mockSpinner.fail).toHaveBeenCalledWith('✖ Installation failed');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('You can try installing manually')
      );
    });

    it('should handle spawn errors', async () => {
      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      process.nextTick(() => {
        mockChildProcess.emit('error', new Error('spawn error'));
      });

      const result = await installPromise;

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.installSkipped).toBe(true);
      expect(mockSpinner.fail).toHaveBeenCalled();
    });

    it('should provide helpful suggestions for permission errors', async () => {
      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('EACCES: permission denied'));
        mockChildProcess.emit('exit', 1);
      });

      const result = await installPromise;

      expect(result.ok).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Try clearing npm cache'));
    });

    it('should provide helpful suggestions for network errors', async () => {
      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('network timeout'));
        mockChildProcess.emit('exit', 1);
      });

      const result = await installPromise;

      expect(result.ok).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Check your internet connection')
      );
    });

    it('should provide helpful suggestions for disk space errors', async () => {
      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      process.nextTick(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('ENOSPC: no space left on device'));
        mockChildProcess.emit('exit', 1);
      });

      const result = await installPromise;

      expect(result.ok).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Not enough disk space'));
    });

    it('should handle invalid package manager command', async () => {
      (getInstallCommand as any).mockReturnValue([]);

      const context: ScaffoldResult = createMockContext();

      const result = await install(context);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.installSkipped).toBe(true);
      expect(mockSpinner.fail).toHaveBeenCalled();
    });
  });

  describe('signal handling', () => {
    it('should handle SIGINT interruption', async () => {
      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      // Get the SIGINT handler that was registered
      const sigintCall = processOnceSpy.mock.calls.find((call: any[]) => call[0] === 'SIGINT');
      expect(sigintCall).toBeDefined();
      const sigintHandler = sigintCall![1];

      // Simulate SIGINT
      try {
        sigintHandler();
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGINT');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Installation interrupted');
      expect(processExitSpy).toHaveBeenCalledWith(130);

      // Clean up by emitting exit
      mockChildProcess.emit('exit', 0);
      await installPromise;
    });

    it('should clean up signal handler on child process exit', async () => {
      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      // Get the SIGINT handler
      const sigintCall = processOnceSpy.mock.calls.find((call: any[]) => call[0] === 'SIGINT');
      const sigintHandler = sigintCall![1];

      // Emit exit
      process.nextTick(() => {
        mockChildProcess.emit('exit', 0);
      });

      await installPromise;

      // Verify handler was removed
      expect(processRemoveListenerSpy).toHaveBeenCalledWith('SIGINT', sigintHandler);
    });
  });

  describe('timing', () => {
    it('should measure installation duration', async () => {
      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      // Add a small delay before emitting exit to ensure measurable duration
      await new Promise(resolve => setTimeout(resolve, 10));
      mockChildProcess.emit('exit', 0);

      const result = await installPromise;

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.installDuration).toBeDefined();
      expect(typeof result.value.installDuration).toBe('number');
      expect(result.value.installDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty stderr output', async () => {
      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      // Exit with error but no stderr
      process.nextTick(() => {
        mockChildProcess.emit('exit', 1);
      });

      const result = await installPromise;

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(result.value.installSkipped).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('You can try installing manually')
      );
    });

    it('should handle Windows platform correctly', async () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });

      const context: ScaffoldResult = createMockContext();

      const installPromise = install(context);

      process.nextTick(() => {
        mockChildProcess.emit('exit', 0);
      });

      await installPromise;

      expect(spawn).toHaveBeenCalledWith('npm', ['install'], {
        cwd: '/path/to/test-app',
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true,
      });

      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });
  });
});
