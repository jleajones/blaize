import boxen from 'boxen';

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
    // installDuration is optional, so not included by default
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

      // Also verify boxen was called correctly
      expect(boxen).toHaveBeenCalledWith(
        '[bold.blue]🔍 Dry run completed successfully![/bold.blue]',
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'blue',
        }
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

  describe('normal mode', () => {
    it('should display success message with green border', () => {
      displaySuccess(defaultContext);

      expect(boxen).toHaveBeenCalledWith(
        '[bold.green]✨ Project created successfully![/bold.green]',
        expect.objectContaining({
          borderColor: 'green',
        })
      );
    });

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

    it('should not display installation time if not provided', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(logCalls).not.toContain('Installation Time');
    });

    it('should include install step if installation was skipped', () => {
      const context: InstallResult = {
        ...defaultContext,
        installSkipped: true,
        packageManager: 'pnpm',
      };

      displaySuccess(context);

      expect(getRunCommand).toHaveBeenCalledWith('pnpm', 'install');

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(logCalls).toContain('Install dependencies');
      expect(logCalls).toContain('pnpm run install');
    });

    it('should not include install step if installation was completed', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(logCalls).not.toContain('Install dependencies');
    });

    it('should display all standard next steps', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      // Check for all expected steps
      expect(logCalls).toContain('Navigate to project');
      expect(logCalls).toContain('cd my-awesome-app');

      expect(logCalls).toContain('Start development server');
      expect(logCalls).toContain('npm run dev');

      expect(logCalls).toContain('Type check');
      expect(logCalls).toContain('npm run type-check');

      expect(logCalls).toContain('Build for production');
      expect(logCalls).toContain('npm run build');
    });

    it('should display project structure', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('Project structure');
      expect(logCalls).toContain('src/');
      expect(logCalls).toContain('app.ts');
      expect(logCalls).toContain('routes/');
      expect(logCalls).toContain('index.ts');
      expect(logCalls).toContain('health.ts');
    });

    it('should display available endpoints', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('Available endpoints');
      expect(logCalls).toContain('http://localhost:3000/');
      expect(logCalls).toContain('http://localhost:3000/health');
      expect(logCalls).toContain('Welcome message');
      expect(logCalls).toContain('Health check');
    });

    it('should display resources section', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('Resources');
      expect(logCalls).toContain('Documentation');
      expect(logCalls).toContain('https://github.com/jleajones/blaize');
      expect(logCalls).toContain('Report issues');
      expect(logCalls).toContain('https://github.com/jleajones/blaize/issues');
      expect(logCalls).toContain('Discord');
      expect(logCalls).toContain('https://discord.gg/blaizejs');
    });

    it('should display tips section', () => {
      displaySuccess(defaultContext);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      expect(logCalls).toContain('Tips');
      expect(logCalls).toContain('test:coverage');
      expect(logCalls).toContain('Hot reload is enabled');
      expect(logCalls).toContain('src/routes/');
      expect(logCalls).toContain('add new API endpoints');
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
      expect(getRunCommand).toHaveBeenCalledWith('pnpm', 'type-check');
      expect(getRunCommand).toHaveBeenCalledWith('pnpm', 'build');
      expect(getRunCommand).toHaveBeenCalledWith('pnpm', 'test:coverage');
    });

    it('should use correct commands for yarn', () => {
      const context: InstallResult = {
        ...defaultContext,
        packageManager: 'yarn',
      };

      displaySuccess(context);

      expect(getRunCommand).toHaveBeenCalledWith('yarn', 'dev');
      expect(getRunCommand).toHaveBeenCalledWith('yarn', 'type-check');
      expect(getRunCommand).toHaveBeenCalledWith('yarn', 'build');
    });

    it('should use correct commands for bun', () => {
      const context: InstallResult = {
        ...defaultContext,
        packageManager: 'bun',
      };

      displaySuccess(context);

      expect(getRunCommand).toHaveBeenCalledWith('bun', 'dev');
      expect(getRunCommand).toHaveBeenCalledWith('bun', 'type-check');
      expect(getRunCommand).toHaveBeenCalledWith('bun', 'build');
    });
  });

  describe('formatting and structure', () => {
    it('should use proper separators and spacing', () => {
      displaySuccess(defaultContext);

      // Check for newlines and separators
      expect(consoleLogSpy).toHaveBeenCalledWith('\n');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('─'.repeat(50)));
    });

    it('should number the steps correctly', () => {
      const context: InstallResult = {
        ...defaultContext,
        installSkipped: true,
      };

      displaySuccess(context);

      const logCalls = consoleLogSpy.mock.calls.flat().join('\n');

      // With install step, should have steps 1-5
      expect(logCalls).toContain('[gray]  1.[/gray]');
      expect(logCalls).toContain('[gray]  2.[/gray]');
      expect(logCalls).toContain('[gray]  3.[/gray]');
      expect(logCalls).toContain('[gray]  4.[/gray]');
      expect(logCalls).toContain('[gray]  5.[/gray]');
    });

    it('should format file tree with proper indentation', () => {
      displaySuccess(defaultContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('[gray]  src/[/gray]');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[gray]  ├── app.ts           # Server setup[/gray]'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[gray]  └── routes/          # API routes[/gray]'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[gray]      ├── index.ts     # Root endpoint[/gray]'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[gray]      └── health.ts    # Health check\n[/gray]'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle context with minimal fields', () => {
      const minimalContext: InstallResult = {
        name: 'test',
        typescript: false,
        git: false,
        install: false,
        latest: false,
        dryRun: false,
        help: false,
        version: false,
        projectPath: '/test',
        packageManager: 'npm',
        template: {
          name: 'minimal',
          files: [],
          scripts: {},
          getDependencies: vi.fn(),
          getDevDependencies: vi.fn(),
        },
        filesCreated: [],
        installSkipped: false,
      };

      expect(() => displaySuccess(minimalContext)).not.toThrow();

      const result = displaySuccess(minimalContext);
      expect(result).toBe(minimalContext);
    });

    it('should handle very long project names', () => {
      const context: InstallResult = {
        ...defaultContext,
        name: 'my-super-awesome-amazing-fantastic-project-with-a-very-long-name',
      };

      displaySuccess(context);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[bold]📁 Project:[/bold]',
        '[cyan]my-super-awesome-amazing-fantastic-project-with-a-very-long-name[/cyan]'
      );
    });
  });
});
