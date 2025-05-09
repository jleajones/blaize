# BlaizeJS TypeScript Configurations

Shared TypeScript configurations for the BlaizeJS monorepo.

## Available Configurations

| Configuration | Description |
|---------------|-------------|
| `base.json` | Base configuration with strict type checking and modern ES features |
| `node.json` | Configuration for Node.js packages (extends `base.json`) |
| `library.json` | Configuration for publishing libraries (extends `node.json`) |
| `test.json` | Configuration for test files (extends `node.json`) |
| `react.json` | Configuration for React applications (extends `base.json`) |

## Usage

### Inside the BlaizeJS monorepo

In your package's `tsconfig.json`:

```json
{
  "extends": "../../configs/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

### With references (for workspaces)

```json
{
  "extends": "../../configs/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../shared" }
  ]
}
```

### For test configurations

Create a separate `tsconfig.test.json` file:

```json
{
  "extends": "../../configs/tsconfig/test.json",
  "include": ["src/**/*", "test/**/*"]
}
```

Then in your test command:

```bash
vitest run --config ./vitest.config.ts --typecheck --tsconfig ./tsconfig.test.json
```

## Configuration Details

### base.json

The foundation configuration with:

- ES2022 target
- Strict type checking
- ESM modules
- Source maps and declaration files
- Modern TypeScript features

### node.json (extends base.json)

Additional settings for Node.js:

- NodeNext module resolution
- Node.js types
- Incremental compilation

### library.json (extends node.json)

Settings optimized for publishable packages:

- TypeScript project references (`composite: true`)
- Clean API surface with declaration maps
- Prevents emitting on errors

### test.json (extends node.json)

Settings for test files:

- Includes Vitest types
- Less strict checking for tests
- Allows JavaScript in tests
- Optimized for test execution

### react.json (extends base.json)

Settings for React applications:

- React JSX transform
- DOM library types
- Settings for mixed JS/TS codebases

## TypeScript Configuration Philosophy

The BlaizeJS TypeScript configurations follow these principles:

1. **Strict by default**: Catch errors at compile time, not runtime
2. **Modern JavaScript**: Target the latest ECMAScript features
3. **ESM-first**: Prioritize ECMAScript modules
4. **Developer experience**: Comprehensive type checking with helpful errors
5. **Performance**: Incremental builds and other optimizations