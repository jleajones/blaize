import baseConfig from '@blaizejs/eslint-config/node';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**'],
  },
  {
    // Package-specific overrides
    files: ['src/**/*.ts'],
    rules: {
      // Any custom rules for the BlaizeJS core package
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // Test file configuration
    files: ['test/**/*.ts'],
    rules: {
      // Relaxed rules for test files
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
