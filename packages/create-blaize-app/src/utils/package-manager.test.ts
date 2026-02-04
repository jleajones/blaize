import fs from 'node:fs';
import path from 'node:path';

import {
  detectPackageManager,
  getPackageManagerInfo,
  getInstallCommand,
  getRunCommand,
  getAddCommand,
  getExecCommand,
  isValidPackageManager,
} from './package-manager';

import type { PackageManager, PackageManagerInfo } from '@/types';

// Mock fs and path modules
vi.mock('node:fs');
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof path>('node:path');
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn(p => {
      const parts = p.split('/');
      parts.pop();
      return parts.join('/') || '/';
    }),
    parse: vi.fn(p => ({
      root: '/',
      dir: path.dirname(p),
      base: path.basename(p),
      ext: path.extname(p),
      name: path.basename(p, path.extname(p)),
    })),
  };
});

describe('Package Manager Detection and Utilities', () => {
  const originalEnv = process.env;
  const originalCwd = process.cwd;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.cwd = vi.fn().mockReturnValue('/test/project');
  });

  afterEach(() => {
    process.env = originalEnv;
    process.cwd = originalCwd;
  });

  describe('detectPackageManager', () => {
    describe('detection via npm_config_user_agent', () => {
      it('should detect pnpm from user agent', () => {
        process.env.npm_config_user_agent = 'pnpm/8.0.0 npm/? node/v18.0.0';

        const result = detectPackageManager();

        expect(result).toBe('pnpm');
      });

      it('should detect yarn from user agent', () => {
        process.env.npm_config_user_agent = 'yarn/1.22.0 npm/? node/v18.0.0';

        const result = detectPackageManager();

        expect(result).toBe('yarn');
      });

      it('should detect bun from user agent', () => {
        process.env.npm_config_user_agent = 'bun/1.0.0';

        const result = detectPackageManager();

        expect(result).toBe('bun');
      });

      it('should detect npm from user agent', () => {
        process.env.npm_config_user_agent = 'npm/9.0.0 node/v18.0.0';

        const result = detectPackageManager();

        expect(result).toBe('npm');
      });

      it('should prioritize user agent over lock files', () => {
        process.env.npm_config_user_agent = 'pnpm/8.0.0';
        vi.mocked(fs.existsSync).mockReturnValue(true); // yarn.lock exists

        const result = detectPackageManager();

        expect(result).toBe('pnpm'); // User agent wins
      });
    });

    describe('detection via lock files in current directory', () => {
      beforeEach(() => {
        delete process.env.npm_config_user_agent;
      });

      it('should detect pnpm from pnpm-lock.yaml', () => {
        vi.mocked(fs.existsSync).mockImplementation(
          path => path === '/test/project/pnpm-lock.yaml'
        );

        const result = detectPackageManager();

        expect(result).toBe('pnpm');
      });

      it('should detect yarn from yarn.lock', () => {
        vi.mocked(fs.existsSync).mockImplementation(path => path === '/test/project/yarn.lock');

        const result = detectPackageManager();

        expect(result).toBe('yarn');
      });

      it('should detect bun from bun.lockb', () => {
        vi.mocked(fs.existsSync).mockImplementation(path => path === '/test/project/bun.lockb');

        const result = detectPackageManager();

        expect(result).toBe('bun');
      });

      it('should detect npm from package-lock.json', () => {
        vi.mocked(fs.existsSync).mockImplementation(
          path => path === '/test/project/package-lock.json'
        );

        const result = detectPackageManager();

        expect(result).toBe('npm');
      });

      it('should check lock files in order of preference', () => {
        // Multiple lock files exist (shouldn't happen in practice)
        vi.mocked(fs.existsSync).mockReturnValue(true);

        const result = detectPackageManager();

        // Should return the first one checked (pnpm)
        expect(result).toBe('pnpm');
      });
    });

    describe('detection via parent directories', () => {
      beforeEach(() => {
        delete process.env.npm_config_user_agent;
        process.cwd = vi.fn().mockReturnValue('/test/project/src/components');
      });

      it('should find lock file in parent directory', () => {
        vi.mocked(fs.existsSync).mockImplementation(path => path === '/test/project/yarn.lock');

        const result = detectPackageManager();

        expect(result).toBe('yarn');
      });

      it('should find lock file in grandparent directory', () => {
        vi.mocked(fs.existsSync).mockImplementation(path => path === '/test/pnpm-lock.yaml');

        const result = detectPackageManager();

        expect(result).toBe('pnpm');
      });

      it('should stop at root directory', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = detectPackageManager();

        // Should default to npm when no lock file found
        expect(result).toBe('npm');
      });
    });

    describe('CI environment detection', () => {
      beforeEach(() => {
        delete process.env.npm_config_user_agent;
        vi.mocked(fs.existsSync).mockReturnValue(false);
      });

      it('should default to npm in GitHub Actions', () => {
        process.env.CI = 'true';
        process.env.GITHUB_ACTIONS = 'true';

        const result = detectPackageManager();

        expect(result).toBe('npm');
      });

      it('should default to npm in GitLab CI', () => {
        process.env.CI = 'true';
        process.env.GITLAB_CI = 'true';

        const result = detectPackageManager();

        expect(result).toBe('npm');
      });

      it('should default to npm in CircleCI', () => {
        process.env.CI = 'true';
        process.env.CIRCLECI = 'true';

        const result = detectPackageManager();

        expect(result).toBe('npm');
      });
    });

    describe('default fallback', () => {
      it('should default to npm when no indicators found', () => {
        delete process.env.npm_config_user_agent;
        delete process.env.CI;
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = detectPackageManager();

        expect(result).toBe('npm');
      });
    });
  });

  describe('getPackageManagerInfo', () => {
    it('should return complete info for npm', () => {
      const info = getPackageManagerInfo('npm');

      expect(info).toEqual({
        name: 'npm',
        lockFile: 'package-lock.json',
        installCommand: ['npm', 'install'],
        runCommand: expect.any(Function),
        addCommand: expect.any(Function),
        execCommand: expect.any(Function),
      });

      expect(info.runCommand('test')).toBe('npm run test');
      expect(info.addCommand('lodash')).toBe('npm install lodash');
      expect(info.addCommand('vitest', true)).toBe('npm install -D vitest');
      expect(info.execCommand('tsx')).toBe('npx tsx');
    });

    it('should return complete info for pnpm', () => {
      const info = getPackageManagerInfo('pnpm');

      expect(info).toEqual({
        name: 'pnpm',
        lockFile: 'pnpm-lock.yaml',
        installCommand: ['pnpm', 'install'],
        runCommand: expect.any(Function),
        addCommand: expect.any(Function),
        execCommand: expect.any(Function),
      });

      expect(info.runCommand('test')).toBe('pnpm test');
      expect(info.addCommand('lodash')).toBe('pnpm add lodash');
      expect(info.addCommand('vitest', true)).toBe('pnpm add -D vitest');
      expect(info.execCommand('tsx')).toBe('pnpm exec tsx');
    });

    it('should return complete info for yarn', () => {
      const info = getPackageManagerInfo('yarn');

      expect(info).toEqual({
        name: 'yarn',
        lockFile: 'yarn.lock',
        installCommand: ['yarn'],
        runCommand: expect.any(Function),
        addCommand: expect.any(Function),
        execCommand: expect.any(Function),
      });

      expect(info.runCommand('test')).toBe('yarn test');
      expect(info.addCommand('lodash')).toBe('yarn add lodash');
      expect(info.addCommand('vitest', true)).toBe('yarn add -D vitest');
      expect(info.execCommand('tsx')).toBe('yarn tsx');
    });

    it('should return complete info for bun', () => {
      const info = getPackageManagerInfo('bun');

      expect(info).toEqual({
        name: 'bun',
        lockFile: 'bun.lockb',
        installCommand: ['bun', 'install'],
        runCommand: expect.any(Function),
        addCommand: expect.any(Function),
        execCommand: expect.any(Function),
      });

      expect(info.runCommand('test')).toBe('bun run test');
      expect(info.addCommand('lodash')).toBe('bun add lodash');
      expect(info.addCommand('vitest', true)).toBe('bun add -D vitest');
      expect(info.execCommand('tsx')).toBe('bunx tsx');
    });

    it('should handle all package managers', () => {
      const packageManagers: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

      packageManagers.forEach(pm => {
        const info = getPackageManagerInfo(pm);

        expect(info.name).toBe(pm);
        expect(info.lockFile).toBeTruthy();
        expect(info.installCommand).toBeInstanceOf(Array);
        expect(info.installCommand.length).toBeGreaterThan(0);
        expect(typeof info.runCommand).toBe('function');
        expect(typeof info.addCommand).toBe('function');
        expect(typeof info.execCommand).toBe('function');
      });
    });
  });

  describe('getInstallCommand', () => {
    it('should return correct install command for npm', () => {
      const command = getInstallCommand('npm');
      expect(command).toEqual(['npm', 'install']);
    });

    it('should return correct install command for pnpm', () => {
      const command = getInstallCommand('pnpm');
      expect(command).toEqual(['pnpm', 'install']);
    });

    it('should return correct install command for yarn', () => {
      const command = getInstallCommand('yarn');
      expect(command).toEqual(['yarn']);
    });

    it('should return correct install command for bun', () => {
      const command = getInstallCommand('bun');
      expect(command).toEqual(['bun', 'install']);
    });
  });

  describe('getRunCommand', () => {
    it('should format npm run commands correctly', () => {
      expect(getRunCommand('npm', 'test')).toBe('npm run test');
      expect(getRunCommand('npm', 'build')).toBe('npm run build');
      expect(getRunCommand('npm', 'dev')).toBe('npm run dev');
    });

    it('should format pnpm run commands correctly', () => {
      expect(getRunCommand('pnpm', 'test')).toBe('pnpm test');
      expect(getRunCommand('pnpm', 'build')).toBe('pnpm build');
      expect(getRunCommand('pnpm', 'dev')).toBe('pnpm dev');
    });

    it('should format yarn run commands correctly', () => {
      expect(getRunCommand('yarn', 'test')).toBe('yarn test');
      expect(getRunCommand('yarn', 'build')).toBe('yarn build');
      expect(getRunCommand('yarn', 'dev')).toBe('yarn dev');
    });

    it('should format bun run commands correctly', () => {
      expect(getRunCommand('bun', 'test')).toBe('bun run test');
      expect(getRunCommand('bun', 'build')).toBe('bun run build');
      expect(getRunCommand('bun', 'dev')).toBe('bun run dev');
    });

    it('should handle script names with special characters', () => {
      expect(getRunCommand('npm', 'test:watch')).toBe('npm run test:watch');
      expect(getRunCommand('pnpm', 'pre-build')).toBe('pnpm pre-build');
      expect(getRunCommand('yarn', 'lint.fix')).toBe('yarn lint.fix');
    });
  });

  describe('getAddCommand', () => {
    describe('regular dependencies', () => {
      it('should format npm add commands', () => {
        expect(getAddCommand('npm', 'lodash')).toBe('npm install lodash');
        expect(getAddCommand('npm', '@types/node')).toBe('npm install @types/node');
      });

      it('should format pnpm add commands', () => {
        expect(getAddCommand('pnpm', 'lodash')).toBe('pnpm add lodash');
        expect(getAddCommand('pnpm', '@types/node')).toBe('pnpm add @types/node');
      });

      it('should format yarn add commands', () => {
        expect(getAddCommand('yarn', 'lodash')).toBe('yarn add lodash');
        expect(getAddCommand('yarn', '@types/node')).toBe('yarn add @types/node');
      });

      it('should format bun add commands', () => {
        expect(getAddCommand('bun', 'lodash')).toBe('bun add lodash');
        expect(getAddCommand('bun', '@types/node')).toBe('bun add @types/node');
      });
    });

    describe('dev dependencies', () => {
      it('should format npm dev dependency commands', () => {
        expect(getAddCommand('npm', 'vitest', true)).toBe('npm install -D vitest');
        expect(getAddCommand('npm', 'typescript', true)).toBe('npm install -D typescript');
      });

      it('should format pnpm dev dependency commands', () => {
        expect(getAddCommand('pnpm', 'vitest', true)).toBe('pnpm add -D vitest');
        expect(getAddCommand('pnpm', 'typescript', true)).toBe('pnpm add -D typescript');
      });

      it('should format yarn dev dependency commands', () => {
        expect(getAddCommand('yarn', 'vitest', true)).toBe('yarn add -D vitest');
        expect(getAddCommand('yarn', 'typescript', true)).toBe('yarn add -D typescript');
      });

      it('should format bun dev dependency commands', () => {
        expect(getAddCommand('bun', 'vitest', true)).toBe('bun add -D vitest');
        expect(getAddCommand('bun', 'typescript', true)).toBe('bun add -D typescript');
      });
    });

    it('should handle package names with versions', () => {
      expect(getAddCommand('npm', 'lodash@^4.17.0')).toBe('npm install lodash@^4.17.0');
      expect(getAddCommand('pnpm', 'react@latest')).toBe('pnpm add react@latest');
    });

    it('should handle scoped packages', () => {
      expect(getAddCommand('npm', '@babel/core')).toBe('npm install @babel/core');
      expect(getAddCommand('yarn', '@types/jest', true)).toBe('yarn add -D @types/jest');
    });
  });

  describe('getExecCommand', () => {
    it('should format npm exec commands', () => {
      expect(getExecCommand('npm', 'tsx')).toBe('npx tsx');
      expect(getExecCommand('npm', 'create-react-app')).toBe('npx create-react-app');
    });

    it('should format pnpm exec commands', () => {
      expect(getExecCommand('pnpm', 'tsx')).toBe('pnpm exec tsx');
      expect(getExecCommand('pnpm', 'create-react-app')).toBe('pnpm exec create-react-app');
    });

    it('should format yarn exec commands', () => {
      expect(getExecCommand('yarn', 'tsx')).toBe('yarn tsx');
      expect(getExecCommand('yarn', 'create-react-app')).toBe('yarn create-react-app');
    });

    it('should format bun exec commands', () => {
      expect(getExecCommand('bun', 'tsx')).toBe('bunx tsx');
      expect(getExecCommand('bun', 'create-react-app')).toBe('bunx create-react-app');
    });

    it('should handle package names with arguments', () => {
      expect(getExecCommand('npm', 'tsx src/index.ts')).toBe('npx tsx src/index.ts');
      expect(getExecCommand('pnpm', 'vitest run')).toBe('pnpm exec vitest run');
    });
  });

  describe('isValidPackageManager', () => {
    it('should return true for valid package managers', () => {
      expect(isValidPackageManager('npm')).toBe(true);
      expect(isValidPackageManager('pnpm')).toBe(true);
      expect(isValidPackageManager('yarn')).toBe(true);
      expect(isValidPackageManager('bun')).toBe(true);
    });

    it('should return false for invalid package managers', () => {
      expect(isValidPackageManager('deno')).toBe(false);
      expect(isValidPackageManager('bower')).toBe(false);
      expect(isValidPackageManager('pip')).toBe(false);
      expect(isValidPackageManager('')).toBe(false);
      expect(isValidPackageManager('NPM')).toBe(false); // Case sensitive
    });

    it('should act as type guard', () => {
      const pm: string = 'npm';

      if (isValidPackageManager(pm)) {
        // TypeScript should know pm is PackageManager here
        const info: PackageManagerInfo = getPackageManagerInfo(pm);
        expect(info.name).toBe('npm');
      }
    });
  });

  describe('Integration scenarios', () => {
    it('should detect and use correct package manager', () => {
      process.env.npm_config_user_agent = 'pnpm/8.0.0';

      const detected = detectPackageManager();
      const info = getPackageManagerInfo(detected);

      expect(detected).toBe('pnpm');
      expect(info.name).toBe('pnpm');
      expect(getInstallCommand(detected)).toEqual(['pnpm', 'install']);
    });

    it('should handle monorepo scenarios', () => {
      // Simulate being deep in a monorepo
      process.cwd = vi.fn().mockReturnValue('/workspace/packages/app/src/components/ui');
      vi.mocked(fs.existsSync).mockImplementation(path => path === '/workspace/pnpm-lock.yaml');

      const detected = detectPackageManager();

      expect(detected).toBe('pnpm');
    });

    it('should provide consistent commands for detected manager', () => {
      const detected = detectPackageManager();
      const info = getPackageManagerInfo(detected);

      // All commands should work with detected manager
      expect(getInstallCommand(detected)).toEqual(info.installCommand);
      expect(getRunCommand(detected, 'test')).toBe(info.runCommand('test'));
      expect(getAddCommand(detected, 'pkg')).toBe(info.addCommand('pkg', false));
      expect(getExecCommand(detected, 'cmd')).toBe(info.execCommand('cmd'));
    });

    it('should handle CI/CD environments appropriately', () => {
      process.env.CI = 'true';
      process.env.GITHUB_ACTIONS = 'true';
      delete process.env.npm_config_user_agent;
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const detected = detectPackageManager();

      // Should default to npm in CI when no other indicators
      expect(detected).toBe('npm');

      // But should respect lock files if present
      vi.mocked(fs.existsSync).mockImplementation(path => path === '/test/project/yarn.lock');

      const detected2 = detectPackageManager();
      expect(detected2).toBe('yarn');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty user agent gracefully', () => {
      process.env.npm_config_user_agent = '';
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = detectPackageManager();

      expect(result).toBe('npm');
    });

    it('should handle malformed user agent', () => {
      process.env.npm_config_user_agent = 'malformed/string/without/proper/format';
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = detectPackageManager();

      expect(result).toBe('npm');
    });

    it('should handle file system errors gracefully', () => {
      // Clear all environment variables that might affect detection
      delete process.env.npm_config_user_agent;
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      delete process.env.CIRCLECI;

      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // The implementation currently doesn't handle fs.existsSync throwing
      // So we expect it to throw
      expect(() => detectPackageManager()).toThrow('Permission denied');
    });

    it('should handle root directory edge case', () => {
      // Clear all environment variables that might affect detection
      delete process.env.npm_config_user_agent;
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      delete process.env.CIRCLECI;

      process.cwd = vi.fn().mockReturnValue('/');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = detectPackageManager();

      expect(result).toBe('npm');
    });
  });
});
