import { createTsupConfig } from '@blaizejs/tsup-config';

export default createTsupConfig({
  // Entry point,
  entry: ['src/index.ts'],
  tsconfig: './tsconfig.json',
  // Output both ESM and CommonJS for maximum compatibility
  format: ['esm'],

  // External packages not to bundle
  external: ['zod', 'chokidar', 'selfsigned'],

  // Clean chunks naming
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.js' : '.cjs',
    };
  },
});
