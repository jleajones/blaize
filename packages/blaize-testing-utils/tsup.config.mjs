import { createTsupConfig } from '@blaizejs/tsup-config';

export default createTsupConfig({
  // Entry point,
  entry: ['src/mocks/context.ts', 'src/mocks/middleware.ts'],
  tsconfig: './tsconfig.json',
  // Output both ESM and CommonJS for maximum compatibility
  format: ['esm', 'cjs'],

  // External packages not to bundle
  external: ['zod'],

  // Clean chunks naming
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.js' : '.cjs',
    };
  },
});
