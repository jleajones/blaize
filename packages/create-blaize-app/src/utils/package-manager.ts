import fs from 'node:fs';
import path from 'node:path';

/**
 * Supported package managers
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Package manager info type
 */
export interface PackageManagerInfo {
  name: PackageManager;
  lockFile: string;
  installCommand: string[];
  runCommand: (script: string) => string;
  addCommand: (pkg: string, dev?: boolean) => string;
  execCommand: (pkg: string) => string;
}

/**
 * Package manager configurations
 */
const PACKAGE_MANAGERS: Record<PackageManager, Omit<PackageManagerInfo, 'name'>> = {
  npm: {
    lockFile: 'package-lock.json',
    installCommand: ['npm', 'install'],
    runCommand: script => `npm run ${script}`,
    addCommand: (pkg, dev) => `npm install${dev ? ' -D ' : ' '}${pkg}`.trim(),
    execCommand: pkg => `npx ${pkg}`,
  },
  pnpm: {
    lockFile: 'pnpm-lock.yaml',
    installCommand: ['pnpm', 'install'],
    runCommand: script => `pnpm ${script}`,
    addCommand: (pkg, dev) => `pnpm add${dev ? ' -D ' : ' '}${pkg}`.trim(),
    execCommand: pkg => `pnpm exec ${pkg}`,
  },
  yarn: {
    lockFile: 'yarn.lock',
    installCommand: ['yarn'],
    runCommand: script => `yarn ${script}`,
    addCommand: (pkg, dev) => `yarn add${dev ? ' -D ' : ' '}${pkg}`.trim(),
    execCommand: pkg => `yarn ${pkg}`,
  },
  bun: {
    lockFile: 'bun.lockb',
    installCommand: ['bun', 'install'],
    runCommand: script => `bun run ${script}`,
    addCommand: (pkg, dev) => `bun add${dev ? ' -D ' : ' '}${pkg}`.trim(),
    execCommand: pkg => `bunx ${pkg}`,
  },
};

/**
 * Detect package manager from environment
 */
export const detectPackageManager = (): PackageManager => {
  // Primary: Check process.env.npm_config_user_agent
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent) {
    if (userAgent.includes('pnpm')) return 'pnpm';
    if (userAgent.includes('yarn')) return 'yarn';
    if (userAgent.includes('bun')) return 'bun';
    if (userAgent.includes('npm')) return 'npm';
  }

  // Secondary: Look for lock files in current directory
  const cwd = process.cwd();
  const lockFiles: Record<string, PackageManager> = {
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'bun.lockb': 'bun',
    'package-lock.json': 'npm',
  };

  for (const [file, pm] of Object.entries(lockFiles)) {
    if (fs.existsSync(path.join(cwd, file))) {
      return pm;
    }
  }

  // Tertiary: Check parent directories for lock files
  let currentDir = cwd;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    for (const [file, pm] of Object.entries(lockFiles)) {
      if (fs.existsSync(path.join(currentDir, file))) {
        return pm;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  // Check CI environment variables
  if (process.env.CI) {
    if (process.env.GITHUB_ACTIONS) return 'npm'; // GitHub Actions default
    if (process.env.GITLAB_CI) return 'npm';
    if (process.env.CIRCLECI) return 'npm';
  }

  // Default: npm (most common)
  return 'npm';
};

/**
 * Get package manager info
 */
export const getPackageManagerInfo = (pm: PackageManager): PackageManagerInfo => {
  return {
    name: pm,
    ...PACKAGE_MANAGERS[pm],
  };
};

/**
 * Get install command for package manager
 */
export const getInstallCommand = (pm: PackageManager): string[] => {
  return PACKAGE_MANAGERS[pm].installCommand;
};

/**
 * Get run command for package manager
 */
export const getRunCommand = (pm: PackageManager, script: string): string => {
  return PACKAGE_MANAGERS[pm].runCommand(script);
};

/**
 * Get add command for package manager
 */
export const getAddCommand = (pm: PackageManager, pkg: string, dev = false): string => {
  return PACKAGE_MANAGERS[pm].addCommand(pkg, dev);
};

/**
 * Get exec command for package manager
 */
export const getExecCommand = (pm: PackageManager, pkg: string): string => {
  return PACKAGE_MANAGERS[pm].execCommand(pkg);
};

/**
 * Validate package manager
 */
export const isValidPackageManager = (pm: string): pm is PackageManager => {
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(pm);
};
