import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface FindRouteFilesOptions {
  /** Directories to ignore */
  ignore?: string[] | undefined;
}

/**
 * Find all route files in the specified directory
 */
export async function findRouteFiles(
  routesDir: string,
  options: FindRouteFilesOptions = {}
): Promise<string[]> {
  // Convert to absolute path if it's relative
  const absoluteDir = path.isAbsolute(routesDir)
    ? routesDir
    : path.resolve(process.cwd(), routesDir);

  console.log('Creating router with routes directory:', absoluteDir);

  // Check if directory exists
  try {
    const stats = await fs.stat(absoluteDir);
    if (!stats.isDirectory()) {
      throw new Error(`Route directory is not a directory: ${absoluteDir}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Route directory not found: ${absoluteDir}`);
    }
    throw error;
  }

  const routeFiles: string[] = [];
  const ignore = options.ignore || ['node_modules', '.git'];

  async function scanDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip ignored directories
      if (entry.isDirectory() && ignore.includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (isRouteFile(entry.name)) {
        routeFiles.push(fullPath);
      }
    }
  }

  await scanDirectory(absoluteDir);
  return routeFiles;
}

/**
 * Check if a file is a valid route file
 */
function isRouteFile(filename: string): boolean {
  // Route files are TypeScript/JavaScript files that don't start with underscore
  return (
    !filename.startsWith('_') &&
    (filename.endsWith('.ts') || filename.endsWith('.js')) &&
    filename !== 'index.ts' &&
    filename !== 'index.js'
  );
}
