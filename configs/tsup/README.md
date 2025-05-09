# BlaizeJS tsup Configuration

Shared tsup configuration for building TypeScript packages in the BlaizeJS monorepo.

## Usage

### Basic Usage

Create a `tsup.config.ts` file in your package:

```ts
import { createTsupConfig } from '@blaizejs/tsup-config';

export default createTsupConfig();
```

This gives you the default configuration with:
- ESM output format
- TypeScript declaration files
- Source maps
- Node.js optimizations

### Custom Configuration

Override any options as needed:

```ts
import { createTsupConfig } from '@blaizejs/tsup-config';

export default createTsupConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  external: ['zod', 'express']
});
```

### Scripts

In your package.json:

```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "type-check": "tsc --noEmit"
  }
}
```

## Configuration Options

The shared configuration includes sensible defaults:

| Option | Default | Description |
|--------|---------|-------------|
| `entry` | `['src/index.ts']` | Entry point(s) for the package |
| `format` | `['esm']` | Output format(s) |
| `dts` | `true` | Generate declaration files |
| `clean` | `true` | Clean output directory before build |
| `sourcemap` | `true` | Generate source maps |
| `target` | `'node18'` | Target JavaScript version |
| `external` | Node.js builtins and workspace packages | Dependencies to exclude from bundle |

## Package Types

### Library Package (default)

```ts
// Optimized for library code
export default createTsupConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs']
});
```

### Browser Package

```ts
// Optimized for browser usage
export default createTsupConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'iife'], 
  target: 'es2020',
  minify: true,
  esbuildOptions(options) {
    options.platform = 'browser';
  }
});
```

### CLI Package

```ts
// Optimized for CLI tools
export default createTsupConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  banner: {
    js: '#!/usr/bin/env node\n'
  }
});
```

## Workflow Benefits

Using tsup with this configuration provides significant DX improvements:

1. **Fast Development**: Builds are 10-100x faster than tsc alone
2. **Type Safety**: Separate type checking via `tsc --noEmit`
3. **Modern Output**: ESM by default with optional CJS compatibility
4. **Simplified Config**: Standardized build configuration across packages
5. **Improved DX**: Quick feedback loop during development

## Environment Variables

The configuration respects these environment variables:

- `NODE_ENV`: Set to `production` for optimized builds
- `TSCONFIG`: Override the tsconfig path

## TypeScript Integration

This setup complements your existing TypeScript configuration:

1. **Building** (Fast): `tsup` compiles code and generates artifacts
2. **Type Checking** (Thorough): `tsc --noEmit` verifies types

## Implementation in Your Project

To set up a package with tsup:

1. **Install tsup**: It's already available as a root dependency
2. **Create Config**: Add tsup.config.ts to your package
3. **Update Scripts**: Add build commands to package.json
4. **Run Build**: Execute `pnpm build` in your package

For more information, see the [tsup documentation](https://tsup.egoist.dev/).