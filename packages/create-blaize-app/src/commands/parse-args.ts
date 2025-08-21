import minimist from 'minimist';
import { z } from 'zod';

import { CLIError } from '../utils/errors';
import { type Result, ok, err } from '../utils/functional';
import { isValidPackageManager, type PackageManager } from '../utils/package-manager';

/**
 * CLI arguments schema - without defaults since we'll apply them manually
 */
const ArgsSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .regex(
      /^[a-z0-9-_]+$/i,
      'Project name can only contain letters, numbers, hyphens, and underscores'
    ),
  template: z.enum(['minimal']),
  packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun'] as const).optional(),
  typescript: z.boolean(),
  git: z.boolean(),
  install: z.boolean(),
  latest: z.boolean(),
  dryRun: z.boolean(),
  help: z.boolean(),
  version: z.boolean(),
});

/**
 * Parsed arguments type
 */
export type ParsedArgs = z.infer<typeof ArgsSchema>;

/**
 * Help text
 */
const HELP_TEXT = `
create-blaize-app - Create BlaizeJS applications with zero configuration

Usage:
  npx create-blaize-app <project-name> [options]
  pnpm create blaize-app <project-name> [options]
  yarn create blaize-app <project-name> [options]
  bun create blaize-app <project-name> [options]

Options:
  --template <n>     Template to use (default: minimal)
  --pm <manager>        Package manager to use (npm, pnpm, yarn, bun)
  --no-git             Skip git initialization
  --no-install         Skip dependency installation
  --latest             Use latest versions instead of stable
  --dry-run            Preview without creating files
  --help, -h           Show this help message
  --version, -v        Show version number

Examples:
  npx create-blaize-app my-app
  npx create-blaize-app my-app --pm pnpm
  npx create-blaize-app my-app --no-install --no-git
  npx create-blaize-app my-app --latest
`;

/**
 * Parse command line arguments
 */
export const parseArgs = (argv: string[]): Result<ParsedArgs, Error> => {
  // Parse with minimist first (outside try-catch for help/version handling)
  const parsed = minimist(argv.slice(2), {
    string: ['template', 'pm'],
    boolean: ['typescript', 'git', 'install', 'latest', 'dry-run', 'help', 'version'],
    alias: {
      h: 'help',
      v: 'version',
      pm: 'packageManager',
    },
    default: {
      typescript: true,
      git: true,
      install: true,
      latest: false,
      'dry-run': false,
      template: 'minimal',
    },
  });

  // Handle help flag (let process.exit mock throw if in test)
  if (parsed.help) {
    console.log(HELP_TEXT);
    process.exit(0);
    // This line will never execute in production,
    // but provides a fallback for type safety
    return ok({} as ParsedArgs);
  }

  // Handle version flag (let process.exit mock throw if in test)
  if (parsed.version) {
    // TODO: Read from package.json
    console.log('0.1.0');
    process.exit(0);
    // This line will never execute in production,
    // but provides a fallback for type safety
    return ok({} as ParsedArgs);
  }

  try {

    // Get project name from first positional argument
    const projectName = parsed._[0];

    if (!projectName) {
      return err(
        new CLIError(
          'Project name is required',
          'MISSING_PROJECT_NAME',
          'Usage: create-blaize-app <project-name>'
        )
      );
    }

    // Validate package manager if provided
    if (parsed.packageManager && !isValidPackageManager(parsed.packageManager)) {
      return err(
        new CLIError(
          `Invalid package manager: ${parsed.packageManager}`,
          'INVALID_PACKAGE_MANAGER',
          'Valid options are: npm, pnpm, yarn, bun'
        )
      );
    }

    // Create args object with defaults applied manually
    const args: ParsedArgs = {
      name: projectName as string,
      template: 'minimal', // Always 'minimal' for now
      packageManager: parsed.packageManager as PackageManager | undefined,
      typescript: Boolean(parsed.typescript),
      git: Boolean(parsed.git),
      install: Boolean(parsed.install),
      latest: Boolean(parsed.latest),
      dryRun: Boolean(parsed['dry-run']),
      help: false,
      version: false,
    };

    // Validate with Zod schema
    const validationResult = ArgsSchema.safeParse(args);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return err(
        new CLIError(
          firstError?.message || 'Validation failed',
          'VALIDATION_ERROR',
          firstError?.path.join('.')
        )
      );
    }

    return ok(validationResult.data);
  } catch (error) {
    if (error instanceof CLIError) {
      return err(error);
    }
    return err(error instanceof Error ? error : new Error(String(error)));
  }
};