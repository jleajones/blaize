import { createTsupConfig } from '@blaizejs/tsup-config';

export default createTsupConfig({
  entry: ['src/**/*.ts'],
  format: ['esm'],
  dts: false,
  tsconfig: './tsconfig.json',
});
