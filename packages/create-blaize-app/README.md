# 🚀 create-blaize-app

> Scaffold a new BlaizeJS application with zero configuration in under 60 seconds

[![npm version](https://badge.fury.io/js/create-blaize-app.svg)](https://www.npmjs.com/package/create-blaize-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🎯 **Zero Configuration** - Start building immediately, no setup required
- 🔒 **TypeScript First** - Full TypeScript support with strict mode enabled
- ⚡ **Lightning Fast** - Under 60 seconds to a running application  
- 📦 **Smart Package Management** - Automatically detects npm, pnpm, yarn, or bun
- 🔥 **Modern Stack** - Built for Node.js 23+ with latest features
- 🗂️ **File-based Routing** - Intuitive routing with automatic route discovery
- 🔄 **Hot Reload** - Development server with automatic reloading (via tsx)
- 🚢 **Production Ready** - Optimized build and deployment scripts

## 🎯 Quick Start

```bash
npx create-blaize-app my-app
cd my-app
npm run dev
```

Your BlaizeJS application is now running at [http://localhost:3000](http://localhost:3000)! 🎉

## 📦 Installation

No global installation needed! Use your preferred package manager:

```bash
# npm (recommended)
npx create-blaize-app my-app

# pnpm
pnpm create blaize-app my-app

# yarn
yarn create blaize-app my-app

# bun
bun create blaize-app my-app
```

## 🛠️ CLI Options

```bash
create-blaize-app <project-name> [options]
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--template <name>` | Choose a template | `minimal` |
| `--pm <manager>` | Package manager (npm, pnpm, yarn, bun) | Auto-detected |
| `--no-git` | Skip git initialization | `false` |
| `--no-install` | Skip dependency installation | `false` |
| `--latest` | Use latest package versions | `false` |
| `--dry-run` | Preview without creating files | `false` |
| `--help, -h` | Show help message | - |
| `--version, -v` | Show version number | - |

### Example Usage

```bash
# Use a specific package manager
npx create-blaize-app my-app --pm pnpm

# Skip installation (install manually later)
npx create-blaize-app my-app --no-install

# Use latest versions (experimental)
npx create-blaize-app my-app --latest

# Preview what will be created
npx create-blaize-app my-app --dry-run
```

## 📂 Project Structure

The CLI generates a clean, organized project structure:

```
my-app/
├── 📁 src/
│   ├── 📄 app.ts                 # Server entry point
│   ├── 📁 routes/                # API routes (file-based routing)
│   │   ├── 📄 index.ts          # Root route (/)
│   │   └── 📄 health.ts         # Health check (/health)
│   └── 📁 __tests__/            # Test files
│       ├── 📁 routes/
│       │   ├── 📄 index.test.ts
│       │   └── 📄 health.test.ts
│       └── 📄 setup.ts          # Test setup
├── 📁 dist/                      # Build output (gitignored)
├── 📄 package.json              # Project configuration
├── 📄 tsconfig.json             # TypeScript configuration
├── 📄 .gitignore               # Git ignore rules
└── 📄 README.md                # Project documentation
```

## 📜 Available Scripts

Your new project comes with these npm scripts:

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload using tsx |
| `npm run build` | Build for production using TypeScript compiler |
| `npm start` | Run production build |
| `npm run type-check` | Check TypeScript types without emitting files |
| `npm run clean` | Remove build artifacts |

## 🧪 Testing Setup (Recommended)

While the minimal template doesn't include testing by default (to keep it minimal), we strongly recommend setting up testing for production applications. Here's how to add our recommended testing stack:

### Step 1: Install Testing Dependencies

```bash
# Using npm
npm install -D vitest @vitest/coverage-v8 @blaizejs/testing-utils

# Using pnpm
pnpm add -D vitest @vitest/coverage-v8 @blaizejs/testing-utils

# Using yarn
yarn add -D vitest @vitest/coverage-v8 @blaizejs/testing-utils

# Using bun
bun add -D vitest @vitest/coverage-v8 @blaizejs/testing-utils
```

### Step 2: Create Vitest Configuration

Create a `vitest.config.ts` file in your project root:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.ts',
        '**/types.ts'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './src/__tests__')
    }
  }
});
```

### Step 3: Update TypeScript Configuration

Update your `tsconfig.json` to include Vitest globals:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // Target and module settings
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",

    // Strict type checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,

    // Additional checks
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    // Module settings
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    // Emit settings
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "tsBuildInfoFile": "./.tsbuildinfo",

    // Path mapping
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@tests/*": ["./src/__tests__/*"]
    },

    // Type roots - uncomment when adding vitest
    "types": [
      // "vitest/globals",
      "node"
    ]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### Step 4: Add Test Scripts

Update your `package.json` scripts:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx --watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "vitest run --typecheck",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "type-check": "tsc --noEmit",
    "clean": "rimraf dist"
  }
}
```

**Note**: The `test` scripts above will only work after installing the testing dependencies as shown in the steps above.

### Step 5: Write Your First Test

Create a test file at `src/__tests__/routes/index.test.ts`:

```typescript
import { describe, test, expect } from 'vitest';
import { createTestContext } from '@blaizejs/testing-utils';
import { GET } from '../../routes/index';

describe('Root Route', () => {
  test('GET / returns welcome message', async () => {
    const ctx = createTestContext({
      method: 'GET',
      path: '/'
    });
    
    const result = await GET.handler(ctx, {});
    
    expect(result).toEqual({
      message: 'Welcome to BlaizeJS!'
    });
  });
});
```

### Step 6: Run Tests

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🔧 System Requirements

- **Node.js**: 23.0.0 or higher
- **Package Manager**: npm, pnpm, yarn, or bun
- **Operating System**: Windows, macOS, or Linux

## 🐛 Troubleshooting

### Permission Denied

If you encounter permission errors:

**Windows**: Run as Administrator
**macOS/Linux**: Use `sudo` or fix npm permissions

```bash
sudo npx create-blaize-app my-app
```

### Network Issues

If you're behind a proxy or have network issues:

```bash
# Skip installation and install manually
npx create-blaize-app my-app --no-install
cd my-app
npm install
```

### Directory Already Exists

The CLI will error if the directory exists and is not empty:

```bash
# Choose a different name
npx create-blaize-app my-other-app

# Or remove the existing directory first
rm -rf my-app
npx create-blaize-app my-app
```

### Node.js Version

This CLI requires Node.js 23 or higher:

```bash
# Check your version
node --version

# Upgrade Node.js if needed
# Using nvm:
nvm install 23
nvm use 23

# Or download from nodejs.org
```

### Package Manager Detection

The CLI automatically detects your package manager. If detection fails:

```bash
# Explicitly specify the package manager
npx create-blaize-app my-app --pm pnpm
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize/packages/create-blaize-app

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the CLI
pnpm build

# Test locally
node dist/index.js test-project
```

### Testing the CLI

```bash
# Run unit tests
pnpm test

# Watch mode for development
pnpm test:watch

# Test with coverage
pnpm test:coverage
```

## 📚 Resources

- 📖 [BlaizeJS Documentation](https://github.com/jleajones/blaize)
- 🐛 [Report Issues](https://github.com/jleajones/blaize/issues)
- 💬 [Discord Community](https://discord.gg/blaizejs)
- 🌟 [Star on GitHub](https://github.com/jleajones/blaize)

## 🚀 Roadmap & Future Enhancements

### ✅ Current Version (0.1.0)
- ✅ **Minimal template** - Basic BlaizeJS API starter
- ✅ **Package manager detection** - Smart detection and configuration
- ✅ **TypeScript configuration** - Optimized tsconfig for BlaizeJS
- ✅ **Git initialization** - Optional git repo setup
- ✅ **Hot reload development** - Using tsx watch mode
- ✅ **Production build** - TypeScript compilation

### 🎯 Version 1.0 (Q1 2025)
- 📝 **Full-stack template** - API + frontend starter
- 🧪 **Testing template** - Pre-configured with Vitest and testing utilities
- 🔐 **Auth template** - Authentication/authorization setup
- 📊 **Database template** - Database integration examples

### 🚀 Version 2.0 (Q2 2025)
- 🎨 **Interactive mode** - Step-by-step project configuration wizard
- 🔧 **Plugin selection** - Choose BlaizeJS plugins during setup
- 📦 **Monorepo template** - Multi-package project structure
- 🌐 **i18n template** - Internationalization setup
- 🔄 **Migration tool** - Convert Express/Fastify apps to BlaizeJS

### 💡 Planned Templates

#### **API Templates**
- `minimal` - Current basic template *(available)*
- `api-complete` - Full API with middleware, error handling, validation
- `microservice` - Microservice architecture with service discovery
- `graphql` - GraphQL API with BlaizeJS

#### **Full-Stack Templates**
- `blaize-react` - BlaizeJS API + React SPA
- `blaize-vue` - BlaizeJS API + Vue.js
- `blaize-solid` - BlaizeJS API + SolidJS
- `blaize-htmx` - Server-driven UI with HTMX

#### **Specialized Templates**
- `websocket` - Real-time communication with WebSockets
- `sse` - Server-Sent Events implementation
- `worker` - Background job processing with queues
- `pipeline` - Data processing pipelines and workflows
- `ml-training` - ML model training job orchestration
- `etl` - Extract, Transform, Load data pipelines

### 🛠️ Planned Features

#### **Developer Experience**
- 🎯 **Dry-run improvements** - Preview full file structure
- 📝 **Git hooks setup** - Husky + lint-staged configuration
- 🔍 **ESLint/Prettier** - Optional code quality tools
- 📊 **Telemetry** - Optional anonymous usage statistics

#### **Configuration Options**
- 🐳 **Docker support** - Generate Dockerfile and docker-compose
- ☁️ **Cloud templates** - Deploy configs for Vercel, Railway, Fly.io
- 🔒 **Security presets** - CORS, CSP, rate limiting configs
- 📈 **Monitoring setup** - APM and logging integration

#### **Community Features**
- 🌟 **Template marketplace** - Community-contributed templates
- 📚 **Example browser** - Browse and clone example projects
- 🔄 **Update notifier** - Notify about BlaizeJS updates
- 💬 **Discord integration** - Quick links to community support

## 📄 License

MIT © BlaizeJS Team

---

Built with ❤️ by the BlaizeJS team

_Create your next blazing-fast Node.js application with confidence and speed._