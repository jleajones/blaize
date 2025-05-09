# BlaizeJS ESLint Configurations

Shared ESLint configurations for the BlaizeJS monorepo.

## Available Configurations

| Configuration | Description |
|---------------|-------------|
| `base.js` | Base configuration with TypeScript, import organization, and modern JS rules |
| `node.js` | Configuration for Node.js packages with additional security rules |
| `react.js` | Configuration for React applications with accessibility and hooks rules |
| `typescript.js` | Extended TypeScript-specific rules for stricter type checking |

## Usage

### Inside the BlaizeJS monorepo

In your package's `eslint.config.js`:

```js
import baseConfig from '../../configs/eslint/base.js';

export default [
  ...baseConfig,
  {
    // Package-specific overrides
    files: ['src/**/*.ts'],
    rules: {
      // Your custom rules
    }
  }
];
```

### For Node.js packages

```js
import nodeConfig from '../../configs/eslint/node.js';

export default [
  ...nodeConfig,
  {
    // Package-specific overrides
  }
];
```

### For React applications

```js
import reactConfig from '../../configs/eslint/react.js';

export default [
  ...reactConfig,
  {
    // Application-specific overrides
  }
];
```

## Configuration Details

### base.js

The foundation configuration with:

- TypeScript ESLint rules
- Import organization rules
- Modern JavaScript best practices
- Code quality checks via SonarJS
- Promise handling rules

```js
// Example rules included
{
  "import/order": ["error", {
    "groups": ["builtin", "external", "internal", ["parent", "sibling"], "index", "object", "type"],
    "newlines-between": "always",
    "alphabetize": { "order": "asc", "caseInsensitive": true }
  }],
  "promise/always-return": "error",
  "sonarjs/cognitive-complexity": ["warn", 15]
}
```

### node.js (extends base.js)

Additional settings for Node.js:

- Node.js-specific ESLint plugins
- Security rules for Node.js applications
- Modern async patterns
- Prevention of common Node.js vulnerabilities

```js
// Example rules included
{
  "n/prefer-promises/fs": "error",
  "n/no-deprecated-api": "warn",
  "security/detect-buffer-noassert": "error"
}
```

### react.js (extends base.js)

Settings for React applications:

- React and JSX specific linting
- React Hooks rules
- Accessibility (a11y) checks
- Performance best practices

```js
// Example rules included
{
  "react/jsx-uses-react": "off", 
  "react/react-in-jsx-scope": "off",
  "react-hooks/rules-of-hooks": "error",
  "jsx-a11y/alt-text": "error"
}
```

### typescript.js (extends base.js)

Extended TypeScript-specific rules:

- Stricter type checking
- Advanced TypeScript patterns
- Naming conventions
- Type consistency rules

```js
// Example rules included
{
  "@typescript-eslint/explicit-module-boundary-types": "warn",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-imports": "error"
}
```

## ESLint Configuration Philosophy

The BlaizeJS ESLint configurations follow these principles:

1. **Consistency over preference**: Enforces consistent code style across the codebase
2. **Catch bugs early**: Uses static analysis to find potential issues
3. **Modern practices**: Encourages use of latest JavaScript/TypeScript features and patterns
4. **Performance awareness**: Highlights patterns that might lead to performance issues
5. **Security first**: Includes rules to catch common security vulnerabilities
6. **Incremental adoption**: Allows customization for specific packages while maintaining a baseline

## Plugin Ecosystem

These configurations leverage several high-quality ESLint plugins:

- **typescript-eslint**: TypeScript-specific linting
- **eslint-plugin-import**: Import/export organization and validation
- **eslint-plugin-promise**: Promise best practices
- **eslint-plugin-unicorn**: Modern JavaScript conventions
- **eslint-plugin-sonarjs**: Bug detection and code smell analysis
- **eslint-plugin-n**: Node.js-specific checks
- **eslint-plugin-security**: Security vulnerability detection
- **eslint-plugin-react**: React-specific linting
- **eslint-plugin-react-hooks**: React Hooks linting
- **eslint-plugin-jsx-a11y**: Accessibility checks for JSX

## Additional Resources

- [ESLint Documentation](https://eslint.org/docs/latest/)
- [typescript-eslint](https://typescript-eslint.io/)
- [Configuring ESLint in a Monorepo](https://eslint.org/docs/latest/use/configure/configuration-files#configuration-file-formats)