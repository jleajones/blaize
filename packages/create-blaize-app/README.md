# create-blaize-app

> Create BlaizeJS applications with zero configuration in under 60 seconds

[![npm version](https://img.shields.io/npm/v/create-blaize-app.svg)](https://www.npmjs.com/package/create-blaize-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

```bash
npx create-blaize-app my-app
cd my-app
npm run dev
```

Your BlaizeJS application is now running at [http://localhost:3000](http://localhost:3000)!

## 📦 Installation

You don't need to install anything globally. Just use npx:

```bash
# With npx (recommended)
npx create-blaize-app my-app

# With pnpm
pnpm create blaize-app my-app

# With yarn
yarn create blaize-app my-app

# With bun
bun create blaize-app my-app
```

## 🎯 Features

- **Zero Configuration** - No setup required, works out of the box
- **TypeScript First** - Full TypeScript support with strict mode enabled
- **Testing Included** - Vitest setup with example tests
- **Fast Installation** - Under 60 seconds to a running app
- **Package Manager Detection** - Automatically detects npm, pnpm, yarn, or bun
- **Modern Node.js** - Requires Node.js 23+ for latest features
- **File-based Routing** - Intuitive routing with the `routes/` directory
- **Hot Reload** - Development server with automatic reloading
- **Production Ready** - Build and start scripts for deployment

## 🛠️ Options

```bash
create-blaize-app <project-name> [options]
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--template <name>` | Template to use | `minimal` |
| `--pm <manager>` | Package manager (npm, pnpm, yarn, bun) | Auto-detected |
| `--no-git` | Skip git initialization | `false` |
| `--no-install` | Skip dependency installation | `false` |
| `--latest` | Use latest package versions | `false` |
| `--dry-run` | Preview without creating files | `false` |
| `--help, -h` | Show help message | - |
| `--version, -v` | Show version number | - |

### Examples

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

## 📂 Generated Project Structure

```
my-app/
├── src/
│   ├── app.ts                 # Server entry point
│   ├── routes/                # API routes (file-based routing)
│   │   ├── index.ts          # Root route (/)
│   │   └── health.ts         # Health check (/health)
│   └── __tests__/            # Test files
│       ├── routes/
│       │   ├── index.test.ts
│       │   └── health.test.ts
│       └── setup.ts          # Test setup
├── dist/                      # Build output (gitignored)
├── package.json              # Project configuration
├── tsconfig.json             # TypeScript configuration
├── vitest.config.ts          # Test configuration
├── .gitignore               # Git ignore rules
└── README.md                # Project documentation
```

## 📜 Available Scripts

The generated project includes these scripts:

| Script | Description |
|--------|-------------|
| `dev` | Start development server with hot reload |
| `build` | Build for production |
| `start` | Run production build |
| `test` | Run tests once |
| `test:watch` | Run tests in watch mode |
| `test:coverage` | Generate test coverage report |
| `type-check` | Check TypeScript types |
| `clean` | Remove build artifacts |

## 🔧 Requirements

- **Node.js**: 23.0.0 or higher
- **Package Manager**: npm, pnpm, yarn, or bun

## 🐛 Troubleshooting

### Permission Denied

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

## 📚 Resources

- [BlaizeJS Documentation](https://github.com/jleajones/blaize)
- [Report Issues](https://github.com/jleajones/blaize/issues)
- [Discord Community](https://discord.gg/blaizejs)

## 📄 License

MIT © BlaizeJS Team

---

Built with ❤️ by the BlaizeJS team