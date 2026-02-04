import { displaySuccess } from './success';
import { getRunCommand } from '../utils/package-manager';

import type { InstallResult } from '@/types';

// Mock the external dependencies
vi.mock('chalk', () => ({
  default: {
    bold: Object.assign(
      vi.fn((text: string) => `[bold]${text}[/bold]`),
      {
        blue: vi.fn((text: string) => `[bold.blue]${text}[/bold.blue]`),
        green: vi.fn((text: string) => `[bold.green]${text}[/bold.green]`),
      }
    ),
    blue: vi.fn((text: string) => `[blue]${text}[/blue]`),
    green: vi.fn((text: string) => `[green]${text}[/green]`),
    yellow: vi.fn((text: string) => `[yellow]${text}[/yellow]`),
    cyan: vi.fn((text: string) => `[cyan]${text}[/cyan]`),
    gray: vi.fn((text: string) => `[gray]${text}[/gray]`),
  },
}));

vi.mock('boxen', () => ({
  default: vi.fn((text: string, options: any) => `[boxen:${options.borderColor}]${text}[/boxen]`),
}));

vi.mock('../utils/package-manager', () => ({
  getRunCommand: vi.fn((pm: string, script: string) => `${pm} run ${script}`),
}));

describe('displaySuccess', () => {
  let consoleLogSpy: any;

  const defaultContext: InstallResult = {
    // ValidatedInputs fields
    name: 'my-awesome-app',
    typescript: true,
    git: true,
    install: true,
    latest: false,
    dryRun: false,
    help: false,
    version: false,
    projectPath: '/path/to/my-awesome-app',
    packageManager: 'npm',
    template: {
      name: 'minimal',
      files: [],
      scripts: {},
      getDependencies: vi.fn(),
      getDevDependencies: vi.fn(),
    },
    // ScaffoldResult fields
    filesCreated: [],
    // InstallResult fields
    installSkipped: false,
  };

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('dry run mode', () => {
    it('should display dry run success message', () => {
      const context: InstallResult = {
        ...defaultContext,
        dryRun: true,
      };

      const result = displaySuccess(context);

      expect(result).toBe(context);

      // Should only log 3 times in dry-run mode
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);

      // 1st call: newline
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '\n');

      // 2nd call: boxen output
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        2,
        '[boxen:blue][bold.blue]🔍 Dry run completed successfully![/bold.blue][/boxen]'
      );

      // 3rd call: dry-run message
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        3,
        '[blue]No files were created. Remove --dry-run to create the project.\n[/blue]'
      );
    });

    it('should not display next steps in dry run mode', () => {
      const context: InstallResult = {
        ...defaultContext,
        dryRun: true,
      };

      displaySuccess(context);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(logCalls).not.toContain('Next steps');
      expect(logCalls).not.toContain('Project structure');
      expect(logCalls).not.toContain('Available endpoints');
    });
  });

  describe('minimal template', () => {
    it('should display minimal template information', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      // Check template name
      expect(logCalls).toContain('[cyan]minimal[/cyan]');
      expect(logCalls).toContain('Minimal template with core BlaizeJS features');

      // Check minimal-specific features
      expect(logCalls).toContain('File-based routing');
      expect(logCalls).toContain('Type-safe file uploads');
      expect(logCalls).toContain('Server-Sent Events');
    });

    it('should display minimal template endpoints', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('https://localhost:7485/');
      expect(logCalls).toContain('https://localhost:7485/health');
      expect(logCalls).toContain('https://localhost:7485/users');
      expect(logCalls).toContain('https://localhost:7485/upload');
      expect(logCalls).toContain('https://localhost:7485/events/stream');
    });

    it('should not include Redis steps for minimal template', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).not.toContain('docker compose up -d');
      expect(logCalls).not.toContain('Redis');
    });
  });

  describe('advanced template', () => {
    const advancedContext: InstallResult = {
      ...defaultContext,
      template: {
        name: 'advanced',
        files: [],
        scripts: {},
        getDependencies: vi.fn(),
        getDevDependencies: vi.fn(),
      },
    };

    it('should display advanced template information', () => {
      displaySuccess(advancedContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      // Check template name
      expect(logCalls).toContain('[cyan]advanced[/cyan]');
      expect(logCalls).toContain('Advanced template with Redis');

      // Check advanced-specific features
      expect(logCalls).toContain('Redis-powered EventBus');
      expect(logCalls).toContain('Docker Compose');
      expect(logCalls).toContain('Queue');
      expect(logCalls).toContain('Cache');
      expect(logCalls).toContain('Metrics');
    });

    it('should display advanced template endpoints', () => {
      displaySuccess(advancedContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('https://localhost:7485/cache/dashboard');
      expect(logCalls).toContain('https://localhost:7485/queue/stats');
      expect(logCalls).toContain('https://localhost:7485/metrics');
    });

    it('should include Redis setup step', () => {
      displaySuccess(advancedContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('Start Redis');
      expect(logCalls).toContain('docker compose up -d');
    });

    it('should include Redis Commander tip', () => {
      displaySuccess(advancedContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('Redis Commander');
      expect(logCalls).toContain('http://localhost:8081');
    });
  });

  describe('common features', () => {
    it('should display project information', () => {
      displaySuccess(defaultContext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[bold]📁 Project:[/bold]',
        '[cyan]my-awesome-app[/cyan]'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[bold]📦 Package Manager:[/bold]',
        '[cyan]npm[/cyan]'
      );
    });

    it('should include environment template copy step', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('Copy environment template');
      expect(logCalls).toContain('cp .env.example .env');
    });

    it('should display installation time if provided', () => {
      const context: InstallResult = {
        ...defaultContext,
        installDuration: 12.5,
      };

      displaySuccess(context);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[bold]⏱️  Installation Time:[/bold]',
        '[cyan]12.5s[/cyan]'
      );
    });

    it('should include install step if installation was skipped', () => {
      const context: InstallResult = {
        ...defaultContext,
        installSkipped: true,
      };

      displaySuccess(context);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('Install dependencies');
      expect(logCalls).toContain('npm run install');
    });

    it('should display resources section', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('Resources');
      expect(logCalls).toContain('https://github.com/jleajones/blaize');
      expect(logCalls).toContain('https://github.com/jleajones/blaize/issues');
      expect(logCalls).toContain('https://discord.gg/blaizejs');
    });

    it('should end with happy coding message', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(logCalls).toContain('Happy coding! 🔥');
    });

    it('should return the context unchanged', () => {
      const result = displaySuccess(defaultContext);
      expect(result).toBe(defaultContext);
    });
  });

  describe('package manager variations', () => {
    it('should use correct commands for pnpm', () => {
      const context: InstallResult = {
        ...defaultContext,
        packageManager: 'pnpm',
        installSkipped: true,
      };

      displaySuccess(context);

      expect(getRunCommand).toHaveBeenCalledWith('pnpm', 'install');
      expect(getRunCommand).toHaveBeenCalledWith('pnpm', 'dev');
      expect(getRunCommand).toHaveBeenCalledWith('pnpm', 'test');
      expect(getRunCommand).toHaveBeenCalledWith('pnpm', 'build');
    });
  });
});
