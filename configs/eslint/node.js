// @ts-nocheck
import baseConfig from './base.js';
import nPlugin from 'eslint-plugin-n';
import securityPlugin from 'eslint-plugin-security';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    plugins: {
      n: nPlugin,
      security: securityPlugin,
    },
    languageOptions: {
      globals: {
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
      },
    },
    settings: {
      n: {
        tryExtensions: ['.js', '.json', '.node', '.ts'],
      },
    },
    rules: {
      // Modern Node.js rules
      'n/no-unsupported-features/es-syntax': 'off', // TypeScript handles this
      'n/no-missing-import': 'off', // TypeScript handles this
      'n/no-unpublished-import': 'off', // Too restrictive for a monorepo
      'n/no-extraneous-import': 'error',
      'n/no-deprecated-api': 'warn',
      'n/prefer-global/process': ['error', 'always'],
      'n/prefer-global/buffer': ['error', 'always'],
      'n/prefer-global/url': ['error', 'always'],
      'n/prefer-global/url-search-params': ['error', 'always'],

      // Modern async practices
      'n/prefer-promises/fs': 'error', // Use fs.promises
      'n/prefer-promises/dns': 'error',
      // 'n/prefer-promises/stream': 'error',

      // Security rules
      'security/detect-object-injection': 'off', // Too many false positives
      'security/detect-non-literal-regexp': 'warn',
      // 'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-buffer-noassert': 'error',
      // 'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
    },
  },
];
