import { createTsupConfig } from '@blaizejs/tsup-config';

export default createTsupConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // No type declarations needed for CLI
  sourcemap: false, // Smaller package size
  minify: true, // Minimize for faster downloads
  esbuildOptions(options) {
    options.platform = 'node';
    // Keep dynamic imports for lazy loading
    options.keepNames = true;
    options.banner = {
      js: '#!/usr/bin/env node\n',
    };
  },
});
