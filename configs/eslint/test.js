// eslint/test.js
import baseConfig from "./base.js";

export default [
  ...baseConfig,
  {
    plugins: ["vitest"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        jest: "readonly",
      },
    },
    rules: {
      // Relaxed rules for tests
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-identical-functions": "off",
      "max-nested-callbacks": "off", // For describe/it nesting

      // Vitest specific rules
      "vitest/prefer-expect-assertions": "off",
      "vitest/valid-expect": "error",
      "vitest/no-identical-title": "error",
      "vitest/no-done-callback": "error",
      "vitest/prefer-to-be": "error",
      "vitest/prefer-to-have-length": "warn",
      "vitest/valid-title": "warn",
      "vitest/no-focused-tests": "error", // Prevent committing .only tests
      "vitest/no-skipped-tests": "warn", // Warn about skipped tests
      "vitest/expect-expect": "warn", // Ensure tests actually assert something
      "vitest/no-standalone-expect": "error",
      "vitest/no-conditional-tests": "warn",
      "vitest/no-conditional-expect": "error",
      "vitest/no-mocks-import": "error",

      // Common test patterns
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.name="setTimeout"][arguments.length<2]',
          message: "setTimeout must have at least two arguments.",
        },
        {
          selector:
            'CallExpression[callee.name="setInterval"][arguments.length<2]',
          message: "setInterval must have at least two arguments.",
        },
      ],
      "max-lines-per-function": [
        "warn",
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
    },
  },
];
