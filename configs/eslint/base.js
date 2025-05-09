// @ts-nocheck
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

// Import plugins as objects
import importPlugin from 'eslint-plugin-import';
import unicornPlugin from 'eslint-plugin-unicorn';
import promisePlugin from 'eslint-plugin-promise';
import sonarjsPlugin from 'eslint-plugin-sonarjs';

// Create a merged configuration array that can be extended
export default [
  // Include standard configs
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,

  // Our custom base configuration
  {
    // Use plugin objects in flat config format
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
      unicorn: unicornPlugin,
      promise: promisePlugin,
      sonarjs: sonarjsPlugin,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2023,
      },
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
        typescript: {},
      },
      'import/internal-regex': '^@blaizejs/',
    },
    rules: {
      // TypeScript
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Import organization - crucial for maintainability
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
            'object',
            'type',
          ],
          pathGroups: [
            // Group project imports
            {
              pattern: '@blaizejs/**',
              group: 'internal',
              position: 'before',
            },
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-cycle': 'error', // Critical for preventing dependency cycles

      // Unicorn rules - modern JS best practices
      'unicorn/filename-case': 'off', // Too restrictive
      'unicorn/no-null': 'off', // Null is still used in many APIs
      'unicorn/prevent-abbreviations': 'off', // Too aggressive
      'unicorn/prefer-module': 'off', // Support dual ESM/CJS
      'unicorn/prefer-node-protocol': 'error', // Encourage node: protocol

      // Promise rules - essential for async code
      'promise/always-return': 'error',
      'promise/catch-or-return': 'error',
      'promise/no-return-wrap': 'error',

      // SonarJS - code quality rules
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-identical-functions': 'warn',

      // Common issues
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-return-await': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-const': 'error',
      'prefer-template': 'warn',
    },
  },
];
