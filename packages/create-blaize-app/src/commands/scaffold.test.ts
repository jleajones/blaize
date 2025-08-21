import path from 'node:path';

import fs from 'fs-extra';

import { scaffold } from './scaffold';
import { generateReadme, generatePackageJson } from '../templates/generators';
import { registerDirectoryCleanup } from '../utils/cleanup';

import type { ValidatedInputs } from './validate';
import type { Template } from '../templates/minimal';

// Mock all external dependencies
vi.mock('fs-extra');
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((text: string) => `[blue]${text}[/blue]`),
    green: vi.fn((text: string) => `[green]${text}[/green]`),
    yellow: vi.fn((text: string) => `[yellow]${text}[/yellow]`),
  },
}));
vi.mock('../templates/generators', () => ({
  generateTsConfig: vi.fn(() => 'tsconfig content'),
  generateGitIgnore: vi.fn(() => 'gitignore content'),
  generateReadme: vi.fn(() => 'readme content'),
  generatePackageJson: vi.fn(() => Promise.resolve({ name: 'test', version: '1.0.0' })),
}));
vi.mock('../utils/cleanup', () => ({
  registerDirectoryCleanup: vi.fn(),
}));

// Mock child_process spawn
const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: mockSpawn,
}));

describe('scaffold', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  const mockTemplate: ValidatedInputs['template'] = {
    name: 'minimal',
    files: [
      {
        path: 'src/index.ts',
        content: 'console.log("Hello {{projectName}}");',
      },
      {
        path: 'src/utils.ts',
        content: '// Utils for {{projectName}} using {{packageManager}}',
      },
    ],
    scripts: {
      dev: 'tsx src/index.ts',
      build: 'tsc',
    },
    getDependencies: vi.fn(() => Promise.resolve({ blaizejs: '^1.0.0' })),
    getDevDependencies: vi.fn(() => Promise.resolve({ typescript: '^5.0.0' })),
  };

  const defaultInputs: ValidatedInputs = {
    name: 'my-app',
    typescript: true,
    git: true,
    install: true,
    latest: false,
    dryRun: false,
    help: false,
    version: false,
    projectPath: '/test/my-app',
    packageManager: 'npm',
    template: mockTemplate,
  };

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();

    // Default mock implementations
    (fs.ensureDir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.writeJson as any).mockResolvedValue(undefined);

    // Setup default spawn mock that simulates successful git init
    const mockChildProcess = {
      on: vi.fn((event, callback) => {
        if (event === 'exit') {
          // Simulate successful exit
          setTimeout(() => callback(0), 0);
        }
      }),
    };
    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('dry run mode', () => {
    it('should not create any files in dry run mode', async () => {
      const inputs: ValidatedInputs = {
        ...defaultInputs,
        dryRun: true,
      };

      const result = await scaffold(inputs);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      // Should not call any file system operations
      expect(fs.ensureDir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(fs.writeJson).not.toHaveBeenCalled();

      // Should not register cleanup
      expect(registerDirectoryCleanup).not.toHaveBeenCalled();

      // Should log dry run message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[blue]🔍 Dry run mode - no files will be created[/blue]'
      );

      // Should still return files that would be created
      expect(result.value.filesCreated).toContain('src/index.ts');
      expect(result.value.filesCreated).toContain('src/utils.ts');
      expect(result.value.filesCreated).toContain('tsconfig.json');
      expect(result.value.filesCreated).toContain('.gitignore');
      expect(result.value.filesCreated).toContain('README.md');
      expect(result.value.filesCreated).toContain('package.json');
    });

    it('should not initialize git in dry run mode', async () => {
      const inputs: ValidatedInputs = {
        ...defaultInputs,
        dryRun: true,
        git: true,
      };

      await scaffold(inputs);

      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('normal mode', () => {
    it('should create project directory and all files', async () => {
      const result = await scaffold(defaultInputs);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      // Should create project directory
      expect(fs.ensureDir).toHaveBeenCalledWith('/test/my-app');

      // Should register cleanup
      expect(registerDirectoryCleanup).toHaveBeenCalledWith('/test/my-app');

      // Should create directories for nested files
      expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname('/test/my-app/src/index.ts'));
      expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname('/test/my-app/src/utils.ts'));

      // Should write template files with processed content
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/my-app/src/index.ts',
        'console.log("Hello my-app");',
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/my-app/src/utils.ts',
        '// Utils for my-app using npm',
        'utf-8'
      );

      // Should write config files
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/my-app/tsconfig.json',
        'tsconfig content',
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/my-app/.gitignore',
        'gitignore content',
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/my-app/README.md',
        'readme content',
        'utf-8'
      );

      // Should write package.json
      expect(fs.writeJson).toHaveBeenCalledWith(
        '/test/my-app/package.json',
        { name: 'test', version: '1.0.0' },
        { spaces: 2 }
      );

      // Should return all created files
      expect(result.value.filesCreated).toHaveLength(6);
      expect(result.value.filesCreated).toContain('src/index.ts');
      expect(result.value.filesCreated).toContain('src/utils.ts');
      expect(result.value.filesCreated).toContain('tsconfig.json');
      expect(result.value.filesCreated).toContain('.gitignore');
      expect(result.value.filesCreated).toContain('README.md');
      expect(result.value.filesCreated).toContain('package.json');
    });

    it('should log success messages', async () => {
      await scaffold(defaultInputs);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[green]✓ Created project directory: my-app[/green]'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('[green]✓ Generated 6 files[/green]');
    });

    it('should pass correct parameters to generator functions', async () => {
      const inputs: ValidatedInputs = {
        ...defaultInputs,
        name: 'test-project',
        packageManager: 'pnpm',
        latest: true,
      };

      await scaffold(inputs);

      expect(generateReadme).toHaveBeenCalledWith('test-project', 'pnpm');
      expect(generatePackageJson).toHaveBeenCalledWith('test-project', mockTemplate, true);
    });
  });

  describe('template processing', () => {
    it('should replace template variables', async () => {
      const inputs: ValidatedInputs = {
        ...defaultInputs,
        name: 'awesome-app',
        packageManager: 'yarn',
      };

      await scaffold(inputs);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/my-app/src/index.ts',
        'console.log("Hello awesome-app");',
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/my-app/src/utils.ts',
        '// Utils for awesome-app using yarn',
        'utf-8'
      );
    });

    it('should leave unmatched template variables as-is', async () => {
      const templateWithUnknownVar: Template = {
        ...mockTemplate,
        files: [
          {
            path: 'test.ts',
            content: 'Project: {{projectName}}, Unknown: {{unknownVar}}',
          },
        ],
      };

      const inputs: ValidatedInputs = {
        ...defaultInputs,
        template: templateWithUnknownVar,
      };

      await scaffold(inputs);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/my-app/test.ts',
        'Project: my-app, Unknown: {{unknownVar}}',
        'utf-8'
      );
    });
  });

  describe('git initialization', () => {
    it('should initialize git when requested', async () => {
      const mockChildProcess = {
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            callback(0); // Success
          }
        }),
      };
      mockSpawn.mockReturnValue(mockChildProcess);

      const inputs: ValidatedInputs = {
        ...defaultInputs,
        git: true,
      };

      await scaffold(inputs);

      expect(mockSpawn).toHaveBeenCalledWith('git', ['init'], {
        cwd: '/test/my-app',
        stdio: 'pipe',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('[green]✓ Initialized git repository[/green]');
    });

    it('should skip git when not requested', async () => {
      const inputs: ValidatedInputs = {
        ...defaultInputs,
        git: false,
      };

      await scaffold(inputs);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Initialized git repository')
      );
    });

    it('should handle git init failure gracefully', async () => {
      const mockChildProcess = {
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            callback(1); // Failure
          }
        }),
      };
      mockSpawn.mockReturnValue(mockChildProcess);

      const inputs: ValidatedInputs = {
        ...defaultInputs,
        git: true,
      };

      await scaffold(inputs);

      expect(consoleWarnSpy).toHaveBeenCalledWith('[yellow]⚠️  Git initialization failed[/yellow]');
      // Should not throw - continues execution
      expect(consoleLogSpy).toHaveBeenCalledWith('[green]✓ Generated 6 files[/green]');
    });

    it('should handle git not installed', async () => {
      const mockChildProcess = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('git not found'));
          }
        }),
      };
      mockSpawn.mockReturnValue(mockChildProcess);

      const inputs: ValidatedInputs = {
        ...defaultInputs,
        git: true,
      };

      await scaffold(inputs);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[yellow]⚠️  Git initialization skipped[/yellow]'
      );
      // Should not throw - continues execution
      expect(consoleLogSpy).toHaveBeenCalledWith('[green]✓ Generated 6 files[/green]');
    });
  });

  describe('edge cases', () => {
    it('should handle empty template files', async () => {
      const emptyTemplate: ValidatedInputs['template'] = {
        ...mockTemplate,
        files: [],
      };

      const inputs: ValidatedInputs = {
        ...defaultInputs,
        template: emptyTemplate,
      };

      const result = await scaffold(inputs);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      // Should still create config files
      expect(result.value.filesCreated).toContain('tsconfig.json');
      expect(result.value.filesCreated).toContain('.gitignore');
      expect(result.value.filesCreated).toContain('README.md');
      expect(result.value.filesCreated).toContain('package.json');
      expect(result.value.filesCreated).toHaveLength(4);
    });

    it('should handle deeply nested file paths', async () => {
      const nestedTemplate: ValidatedInputs['template'] = {
        ...mockTemplate,
        files: [
          {
            path: 'src/components/ui/button/index.ts',
            content: 'export const Button = () => {}',
          },
        ],
      };

      const inputs: ValidatedInputs = {
        ...defaultInputs,
        template: nestedTemplate,
      };

      await scaffold(inputs);

      expect(fs.ensureDir).toHaveBeenCalledWith(
        path.dirname('/test/my-app/src/components/ui/button/index.ts')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/my-app/src/components/ui/button/index.ts',
        'export const Button = () => {}',
        'utf-8'
      );
    });

    it('should handle special characters in project name', async () => {
      const inputs: ValidatedInputs = {
        ...defaultInputs,
        name: 'my-awesome_app.2024',
        projectPath: '/test/my-awesome_app.2024',
      };

      const result = await scaffold(inputs);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      expect(fs.ensureDir).toHaveBeenCalledWith('/test/my-awesome_app.2024');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[green]✓ Created project directory: my-awesome_app.2024[/green]'
      );
    });
  });

  describe('return value', () => {
    it('should return all input values plus filesCreated', async () => {
      const result = await scaffold(defaultInputs);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');

      // Should include all input values
      expect(result.value.name).toBe(defaultInputs.name);
      expect(result.value.typescript).toBe(defaultInputs.typescript);
      expect(result.value.git).toBe(defaultInputs.git);
      expect(result.value.install).toBe(defaultInputs.install);
      expect(result.value.latest).toBe(defaultInputs.latest);
      expect(result.value.dryRun).toBe(defaultInputs.dryRun);
      expect(result.value.projectPath).toBe(defaultInputs.projectPath);
      expect(result.value.packageManager).toBe(defaultInputs.packageManager);
      expect(result.value.template).toBe(defaultInputs.template);

      // Should add filesCreated
      expect(result.value.filesCreated).toBeDefined();
      expect(Array.isArray(result.value.filesCreated)).toBe(true);
    });
  });
});
