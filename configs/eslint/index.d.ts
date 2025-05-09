/**
 * BlaizeJS ESLint Configurations
 *
 * Type declarations for all ESLint configuration files in this package.
 */

import type { Linter } from 'eslint';

// Shared type for all configuration files
declare const config: Linter.Config[];
export default config;

// Allow importing from specific files
declare module '@blaizejs/eslint-config/base.js' {
  const config: Linter.Config[];
  export default config;
}

declare module '@blaizejs/eslint-config/node.js' {
  const config: Linter.Config[];
  export default config;
}

declare module '@blaizejs/eslint-config/react.js' {
  const config: Linter.Config[];
  export default config;
}

declare module '@blaizejs/eslint-config/typescript.js' {
  const config: Linter.Config[];
  export default config;
}
