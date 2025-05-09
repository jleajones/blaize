import { defineConfig } from 'tsup';
import fs from 'fs';
import path from 'path';

/**
 * Creates a tsup configuration with sensible defaults for BlaizeJS packages
 */
export function createTsupConfig(options = {}) {
  // Try to load package.json for banner info
  let pkg = { name: 'blaizejs-package', version: '0.1.0', description: '' };

  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    pkg = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description || '',
    };
  } catch (e) {
    // Use defaults if package.json can't be read
  }

  return defineConfig({
    // Default entry point is src/index.ts
    entry: ['src/index.ts'],

    // Output as ESM by default (modern)
    format: ['esm'],

    // Generate .d.ts files

    dts: {
      compilerOptions: {
        composite: false,
      },
    },

    // Clean output directory before build
    clean: true,

    // Source maps for debugging
    sourcemap: true,

    // Target Node.js environments
    target: 'node18',

    // Don't bundle Node.js built-ins
    external: [
      // Node.js core modules
      'fs',
      'path',
      'os',
      'util',
      'events',
      'stream',
      'http',
      'https',
      'net',
      'crypto',
      'zlib',
      'url',
      'querystring',
      'buffer',
      'assert',
      'child_process',
      'worker_threads',
      'cluster',
      'dgram',
      'dns',
      'http2',
      'tls',
      'readline',
      // Workspace packages
      /^@blaizejs/,
    ],

    // Ensure proper TypeScript settings
    tsconfig: './tsconfig.json',

    // Override with any options passed
    ...options,

    // Add banner comment with package info
    esbuildOptions(esbuildOptions, context) {
      // First apply any custom esbuildOptions from passed options
      if (options.esbuildOptions) {
        options.esbuildOptions(esbuildOptions, context);
      }

      // Then ensure banner is added
      esbuildOptions.banner = {
        js: `/**
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * 
 * Copyright (c) ${new Date().getFullYear()} BlaizeJS Contributors
 * @license MIT
 */
${esbuildOptions.banner?.js || ''}`,
      };
    },
  });
}

// Default export for direct usage via tsup --config
export default createTsupConfig();
