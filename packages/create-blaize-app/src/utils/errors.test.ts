// eslint-disable-next-line @typescript-eslint/no-unused-vars
import chalk from 'chalk';

import { CLIError, handleError, validateNodeVersion } from './errors';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    red: (str: string) => `[red]${str}[/red]`,
    yellow: (str: string) => `[yellow]${str}[/yellow]`,
    gray: (str: string) => `[gray]${str}[/gray]`,
  },
}));

describe('Error Handling', () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let processExitSpy: any;
  const originalEnv = process.env;
  const originalVersion = process.version;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    process.env = originalEnv;
    // Restore original version
    Object.defineProperty(process, 'version', {
      value: originalVersion,
      writable: true,
      configurable: true,
    });
  });

  describe('CLIError class', () => {
    it('should create error with all properties', () => {
      const error = new CLIError('Test error', 'TEST_CODE', 'Try this', 2);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CLIError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.suggestion).toBe('Try this');
      expect(error.exitCode).toBe(2);
      expect(error.name).toBe('CLIError');
    });

    it('should use default exitCode of 1', () => {
      const error = new CLIError('Test error', 'TEST_CODE');

      expect(error.exitCode).toBe(1);
    });

    it('should work without suggestion', () => {
      const error = new CLIError('Test error', 'TEST_CODE');

      expect(error.suggestion).toBeUndefined();
    });

    it('should have proper stack trace', () => {
      const error = new CLIError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('CLIError');
      expect(error.stack).toContain('Test error');
    });
  });

  describe('handleError function', () => {
    describe('handling CLIError', () => {
      it('should display error message and exit', () => {
        const error = new CLIError('Custom error', 'CUSTOM_CODE');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith(); // Empty line
        expect(consoleErrorSpy).toHaveBeenCalledWith('[red]✖ Custom error[/red]');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should display custom suggestion if provided', () => {
        const error = new CLIError('Error', 'CODE', 'Custom suggestion');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleLogSpy).toHaveBeenCalledWith('[yellow]\n💡 Custom suggestion[/yellow]');
      });

      it('should display suggestion from ERROR_SUGGESTIONS map', () => {
        const error = new CLIError('Permission error', 'EACCES');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[yellow]\n💡 Try running with sudo or check directory permissions[/yellow]'
        );
      });

      it('should prefer custom suggestion over map suggestion', () => {
        const error = new CLIError('Error', 'EACCES', 'Custom override');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleLogSpy).toHaveBeenCalledWith('[yellow]\n💡 Custom override[/yellow]');
        expect(consoleLogSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Try running with sudo')
        );
      });

      it('should display stack trace in DEBUG mode', () => {
        process.env.DEBUG = '1';
        const error = new CLIError('Debug error', 'DEBUG_CODE');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[gray]\nError details:[/gray]');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[gray]'));
      });

      it('should use custom exit code', () => {
        const error = new CLIError('Error', 'CODE', undefined, 5);

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(processExitSpy).toHaveBeenCalledWith(5);
      });
    });

    describe('handling standard Error', () => {
      it('should display error message', () => {
        const error = new Error('Standard error');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[red]✖ Standard error[/red]');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle Node.js error codes', () => {
        const error: any = new Error('Permission denied');
        error.code = 'EACCES';

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[yellow]\n💡 Try running with sudo or check directory permissions[/yellow]'
        );
      });

      it('should detect EACCES in error message', () => {
        const error = new Error('EACCES: permission denied, open file');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[red]✖ Permission denied[/red]');
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[yellow]\n💡 Try running with sudo or check directory permissions[/yellow]'
        );
      });

      it('should detect network errors', () => {
        const error = new Error('network connection failed');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[red]✖ Network error[/red]');
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[yellow]\n💡 Check your internet connection and try again[/yellow]'
        );
      });

      it('should show stack trace in DEBUG mode', () => {
        process.env.DEBUG = '1';
        const error = new Error('Debug error');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[gray]\nStack trace:[/gray]');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[gray]'));
      });

      it('should suggest DEBUG mode when not enabled', () => {
        delete process.env.DEBUG;
        const error = new Error('Some error');

        expect(() => handleError(error)).toThrow('process.exit called');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[gray]\nRun with DEBUG=1 for more information[/gray]'
        );
      });
    });

    describe('handling unknown errors', () => {
      it('should handle string errors', () => {
        expect(() => handleError('String error')).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[red]✖ An unexpected error occurred[/red]');
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[yellow]💡 Try running with DEBUG=1 for more information[/yellow]'
        );
      });

      it('should handle number errors', () => {
        expect(() => handleError(404)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[red]✖ An unexpected error occurred[/red]');
      });

      it('should handle null errors', () => {
        expect(() => handleError(null)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[red]✖ An unexpected error occurred[/red]');
      });

      it('should handle undefined errors', () => {
        expect(() => handleError(undefined)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[red]✖ An unexpected error occurred[/red]');
      });

      it('should display unknown error in DEBUG mode', () => {
        process.env.DEBUG = '1';
        const weirdError = { weird: 'object', code: 123 };

        expect(() => handleError(weirdError)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[gray]\nError:[/gray]');
        expect(consoleErrorSpy).toHaveBeenCalledWith(weirdError);
      });
    });

    describe('error code suggestions', () => {
      const testCases = [
        { code: 'EEXIST', suggestion: 'Choose a different name or remove the existing directory' },
        { code: 'ENOENT', suggestion: 'Make sure the parent directory exists' },
        { code: 'ENOSPC', suggestion: 'Free up disk space and try again' },
        { code: 'NETWORK_ERROR', suggestion: 'Check your internet connection and try again' },
        { code: 'INVALID_NAME', suggestion: 'Use only letters, numbers, hyphens, and underscores' },
        { code: 'VERSION_FETCH', suggestion: 'Unable to fetch latest versions, using defaults' },
        { code: 'PERMISSION_DENIED', suggestion: 'On Windows, try running as Administrator' },
        {
          code: 'MISSING_PROJECT_NAME',
          suggestion: 'Please provide a project name: create-blaize-app <project-name>',
        },
        {
          code: 'INVALID_PACKAGE_MANAGER',
          suggestion: 'Invalid package manager. Use: npm, pnpm, yarn, or bun',
        },
        {
          code: 'INSTALL_FAILED',
          suggestion: 'Installation failed. Try running the install command manually',
        },
        {
          code: 'TEMPLATE_NOT_FOUND',
          suggestion: 'Template not found. Available templates: minimal',
        },
        { code: 'NODE_VERSION', suggestion: 'Node.js 23 or higher is required' },
      ];

      testCases.forEach(({ code, suggestion }) => {
        it(`should show suggestion for ${code}`, () => {
          const error = new CLIError('Error', code);

          expect(() => handleError(error)).toThrow('process.exit called');

          expect(consoleLogSpy).toHaveBeenCalledWith(`[yellow]\n💡 ${suggestion}[/yellow]`);
        });
      });
    });
  });

  describe('validateNodeVersion', () => {
    it('should pass for Node.js 23', () => {
      Object.defineProperty(process, 'version', {
        value: 'v23.0.0',
        writable: true,
        configurable: true,
      });

      expect(() => validateNodeVersion()).not.toThrow();
    });

    it('should pass for Node.js 24', () => {
      Object.defineProperty(process, 'version', {
        value: 'v24.5.1',
        writable: true,
        configurable: true,
      });

      expect(() => validateNodeVersion()).not.toThrow();
    });

    it('should pass for Node.js 30', () => {
      Object.defineProperty(process, 'version', {
        value: 'v30.0.0',
        writable: true,
        configurable: true,
      });

      expect(() => validateNodeVersion()).not.toThrow();
    });

    it('should throw for Node.js 22', () => {
      Object.defineProperty(process, 'version', {
        value: 'v22.11.0',
        writable: true,
        configurable: true,
      });

      expect(() => validateNodeVersion()).toThrow(CLIError);

      try {
        validateNodeVersion();
      } catch (error: any) {
        expect(error.message).toBe('Node.js 23 or higher is required (current: v22.11.0)');
        expect(error.code).toBe('NODE_VERSION');
        expect(error.suggestion).toBe('Please upgrade Node.js to version 23 or higher');
      }
    });

    it('should throw for Node.js 18', () => {
      Object.defineProperty(process, 'version', {
        value: 'v18.17.0',
        writable: true,
        configurable: true,
      });

      expect(() => validateNodeVersion()).toThrow(CLIError);
    });

    it('should throw for Node.js 16', () => {
      Object.defineProperty(process, 'version', {
        value: 'v16.20.2',
        writable: true,
        configurable: true,
      });

      expect(() => validateNodeVersion()).toThrow(CLIError);
    });

    it('should handle version with pre-release tags', () => {
      Object.defineProperty(process, 'version', {
        value: 'v23.0.0-nightly.20240101',
        writable: true,
        configurable: true,
      });

      expect(() => validateNodeVersion()).not.toThrow();
    });

    it('should handle malformed version gracefully', () => {
      Object.defineProperty(process, 'version', {
        value: 'invalid',
        writable: true,
        configurable: true,
      });

      // parseInt will return NaN, which is < 23
      expect(() => validateNodeVersion()).toThrow(CLIError);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full error flow with suggestions', () => {
      const error = new CLIError('Directory already exists', 'EEXIST');

      expect(() => handleError(error)).toThrow('process.exit called');

      // Verify full output sequence
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(1); // Empty line
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[red]✖ Directory already exists[/red]');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[yellow]\n💡 Choose a different name or remove the existing directory[/yellow]'
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle debug mode with full details', () => {
      process.env.DEBUG = '1';
      const error: any = new Error('Network timeout');
      error.code = 'ETIMEDOUT';

      expect(() => handleError(error)).toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[red]✖ Network timeout[/red]');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[gray]\nStack trace:[/gray]');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[gray]'));
    });

    it('should handle validation flow', () => {
      Object.defineProperty(process, 'version', {
        value: 'v20.0.0',
        writable: true,
        configurable: true,
      });

      let caughtError: CLIError | null = null;

      try {
        validateNodeVersion();
      } catch (error) {
        caughtError = error as CLIError;
      }

      expect(caughtError).not.toBeNull();
      expect(() => handleError(caughtError)).toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[red]✖ Node.js 23 or higher is required (current: v20.0.0)[/red]'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[yellow]\n💡 Please upgrade Node.js to version 23 or higher[/yellow]'
      );
    });
  });
});
