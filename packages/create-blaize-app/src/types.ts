import { z } from 'zod';
import { ValidationError } from './validation/error';
import { ArgsSchema } from './commands/parse-args';

/**
 * Template file type
 */
export interface TemplateFile {
  path: string;
  content: string;
}

/**
 * Template type
 */
export interface Template {
  name: string;
  files: TemplateFile[];
  getDependencies: (options?: { latest?: boolean }) => Promise<Record<string, string>>;
  getDevDependencies: (options?: { latest?: boolean }) => Promise<Record<string, string>>;
  scripts: Record<string, string>;
}

/**
 * Schema validator interface (abstraction for future extensibility)
 */
export interface SchemaValidator<T> {
  parse(data: unknown): Result<T, ValidationError>;
  safeParse(data: unknown): {
    success: boolean;
    data?: T;
    error?: ValidationError;
  };
}

/**
 * Result type for error handling
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Version options type
 */
export interface VersionOptions {
  latest?: boolean;
}

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
 * Cleanup task type
 */
export type CleanupTask = () => Promise<void> | void;

/**
 * Validated inputs type - contains everything needed for scaffolding
 */
export interface ValidatedInputs {
  // Original parsed args
  name: string;
  typescript: boolean;
  git: boolean;
  install: boolean;
  latest: boolean;
  dryRun: boolean;
  help: boolean;
  version: boolean;

  // Enhanced/resolved values
  projectPath: string;
  packageManager: PackageManager;
  template: Template;
}

/**
 * Scaffold result type
 */
export interface ScaffoldResult extends ValidatedInputs {
  filesCreated: string[];
}

/**
 * Install result type
 */
export interface InstallResult extends ScaffoldResult {
  installSkipped?: boolean;
  installDuration?: number;
}

/**
 * Install result type
 */
export interface InstallResult extends ScaffoldResult {
  installSkipped?: boolean;
  installDuration?: number;
}

/**
 * Parsed arguments type
 */
export type ParsedArgs = z.infer<typeof ArgsSchema>;
