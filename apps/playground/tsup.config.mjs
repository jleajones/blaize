import { createTsupConfig } from '@blaizejs/tsup-config';

export default createTsupConfig({
  // Entry point - the main file that starts your server
  entry: ['src/**.ts'],

  // Only output ESM for the playground
  format: ['esm'],

  // Don't generate .d.ts files for the playground
  dts: false, // Copy the routes directory to the output
  assets: [
    {
      from: 'src/routes/**/*',
      to: 'dist/routes',
    },
  ],

  // Since this is a playground, not a library to be consumed,
  // we can bundle dependencies
  external: [
    // Only exclude Node.js built-ins
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
  ],

  // Specific tsconfig for the playground
  tsconfig: './tsconfig.json',
});
