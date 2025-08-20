/**
 * Configuration generators for templates
 */

/**
 * Generate TypeScript configuration
 */
export const generateTsConfig = (): string => {
  const config = {
    $schema: 'https://json.schemastore.org/tsconfig',
    compilerOptions: {
      // Target and module settings
      target: 'ES2022',
      lib: ['ES2022'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',

      // Strict type checking
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      strictFunctionTypes: true,
      strictBindCallApply: true,
      strictPropertyInitialization: true,
      noImplicitThis: true,
      useUnknownInCatchVariables: true,
      alwaysStrict: true,

      // Additional checks
      noUncheckedIndexedAccess: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,

      // Module settings
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowJs: false,
      isolatedModules: true,
      verbatimModuleSyntax: true,

      // Emit settings
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      outDir: './dist',
      rootDir: './src',
      tsBuildInfoFile: './.tsbuildinfo',

      // Path mapping
      baseUrl: '.',
      paths: {
        '@/*': ['./src/*'],
        '@tests/*': ['./src/__tests__/*'],
      },

      // Type roots
      types: ['vitest/globals', 'node'],
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', '**/*.test.ts', '**/*.spec.ts'],
  };

  return JSON.stringify(config, null, 2);
};

/**
 * Generate Vitest configuration
 */
export const generateVitestConfig = (): string => {
  return `import { defineConfig } from 'vitest/config';
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
});`;
};

/**
 * Generate .gitignore file
 */
export const generateGitIgnore = (): string => {
  return `# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage
*.test.js
*.spec.js

# Production
dist
build

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode
.idea
*.swp
*.swo
*~
.DS_Store

# TypeScript
*.tsbuildinfo
.tsbuildinfo

# Package manager
.pnpm-debug.log
yarn.lock
package-lock.json
bun.lockb`;
};

/**
 * Generate README.md file
 */
export const generateReadme = (projectName: string, packageManager: string): string => {
  return `# ${projectName}

A BlaizeJS application with TypeScript and testing setup.

## 🚀 Getting Started

### Development

\`\`\`bash
${packageManager === 'npm' ? 'npm run' : packageManager} dev
\`\`\`

Your server will be running at [http://localhost:3000](http://localhost:3000)

### Testing

\`\`\`bash
# Run tests
${packageManager === 'npm' ? 'npm run' : packageManager} test

# Watch mode
${packageManager === 'npm' ? 'npm run' : packageManager} test:watch

# Coverage
${packageManager === 'npm' ? 'npm run' : packageManager} test:coverage
\`\`\`

### Building

\`\`\`bash
# Type check
${packageManager === 'npm' ? 'npm run' : packageManager} type-check

# Build for production
${packageManager === 'npm' ? 'npm run' : packageManager} build

# Run production build
${packageManager === 'npm' ? 'npm run' : packageManager} start
\`\`\`

## 📂 Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── app.ts           # Server setup
│   ├── routes/          # API routes
│   │   ├── index.ts     # Root endpoint
│   │   └── health.ts    # Health check
│   └── __tests__/       # Test files
│       └── routes/      # Route tests
├── dist/                # Build output
├── package.json
├── tsconfig.json
└── vitest.config.ts
\`\`\`

## 🛠️ Available Scripts

- \`dev\` - Start development server with hot reload
- \`build\` - Build for production
- \`start\` - Run production build
- \`test\` - Run tests
- \`test:watch\` - Run tests in watch mode
- \`test:coverage\` - Run tests with coverage
- \`type-check\` - Check TypeScript types
- \`clean\` - Remove build artifacts

## 📚 Learn More

- [BlaizeJS Documentation](https://github.com/jleajones/blaize)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Vitest Documentation](https://vitest.dev/)

---

Built with [BlaizeJS](https://github.com/jleajones/blaize) 🔥
`;
};
