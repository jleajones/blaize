# 🤝 Contributing to BlaizeJS

Welcome to BlaizeJS! We're excited that you want to contribute to building a modern, type-safe Node.js framework. This guide will help you get started with development and understand our workflow.

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >= 23.0.0
- **pnpm**: >= 9.7.0

### Setup

```bash
# Clone the repository
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests to verify setup
pnpm test
```

## 🏗️ Monorepo Structure

BlaizeJS uses a monorepo structure with pnpm workspaces and Turborepo:

```
blaize/
├── 📦 packages/                    # Published npm packages
│   ├── blaize-core/               # Main framework (blaizejs)
│   ├── blaize-client/             # Type-safe client (@blaizejs/client)
│   ├── blaize-types/              # Shared TypeScript types (internal)
│   └── blaize-testing-utils/      # Testing utilities (@blaizejs/testing-utils)
├── 🧩 plugins/                    # Official plugins (future)
├── 🎯 apps/                       # Applications & examples
│   ├── docs/                      # Documentation website
│   ├── examples/                  # Example applications
│   └── playground/                # Development playground
└── ⚙️ configs/                    # Shared configurations
```

### Published vs Internal Packages

- **Published packages** (`packages/*`): These are released to npm and require changesets for modifications
- **Internal packages** (`apps/*`, `configs/*`): These are not published and don't require changesets
- **Types package** (`packages/blaize-types`): Internal-only, provides types to other packages

## 🔄 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
# or  
git checkout -b docs/documentation-update
```

### 2. Make Your Changes

- **Code changes**: Follow TypeScript strict mode and existing patterns
- **Tests**: Add tests for new functionality
- **Documentation**: Update relevant README files

### 3. Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter blaizejs test
pnpm --filter @blaizejs/client test

# Watch mode during development
pnpm test:watch

# Coverage reports
pnpm test:coverage
```

### 4. Code Quality

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Formatting (auto-fix)
pnpm format
```

## 📝 Changesets: When to Use Them

**Changesets are required for changes to published packages** that affect end users. Here's when you need them:

### ✅ Changeset Required

Changes to published packages (`packages/blaize-core`, `packages/blaize-client`, `packages/blaize-testing-utils`):

- 🐛 **Bug fixes** - use `patch`
- 🚀 **New features** - use `minor` 
- 💥 **Breaking changes** - use `major`
- 📚 **API documentation updates** - use `patch`
- ⚡ **Performance improvements** - use `patch` or `minor`

### ❌ Changeset NOT Required

- ⚙️ **Workflow/CI changes** (`.github/workflows/*`)
- 🧪 **Test-only changes** (no functionality change)
- 📖 **README updates** (non-API documentation)
- 🏗️ **Build configuration** (`tsconfig.json`, `package.json` scripts)
- 🎯 **Apps/examples** (`apps/*` directory changes)
- 🔧 **Internal tooling** (`configs/*` directory)

### Creating a Changeset

```bash
# Create a changeset
pnpm changeset

# Follow the prompts:
# 1. Select which packages changed
# 2. Choose the type of change (patch/minor/major)
# 3. Write a clear summary of the change
```

**Example changeset workflow:**
```bash
# You fixed a bug in the core package
pnpm changeset
# ✅ Select: blaizejs
# ✅ Choose: patch
# ✅ Summary: "🐛 Fix route parameter parsing for dynamic routes"
```

## 💬 Commit Messages

Use descriptive commit messages with emojis to indicate the type of change:

### Emoji Guide

- 🐛 **Bug fixes** - `🐛 Fix route parameter parsing issue`
- 🚀 **Enhancements** - `🚀 Add support for custom middleware ordering`
- ✨ **New features** - `✨ Add WebSocket support to core framework`
- 🧪 **Test related** - `🧪 Add integration tests for client package`
- 🔒 **TypeScript** - `🔒 Improve type inference for route handlers`
- ⚙️ **Configuration** - `⚙️ Update ESLint rules for better code quality`
- 📚 **Documentation** - `📚 Update README with new examples`
- 🔧 **Tooling** - `🔧 Add new script for package building`

### Examples

```bash
git commit -m "🐛 Fix middleware execution order in plugin system"
git commit -m "🚀 Improve HTTP/2 performance with connection pooling"
git commit -m "✨ Add file upload support to core framework"
git commit -m "🧪 Add comprehensive tests for routing system"
git commit -m "🔒 Add stricter types for middleware composition"
git commit -m "⚙️ Update Turborepo configuration for better caching"
```

**Note**: When merging PRs, no need to update the merge commit message or description.

## 📋 Pull Request Process

### 1. Commit Your Changes

```bash
# Stage your changes
git add .

# If you made changes to published packages, create a changeset
pnpm changeset

# Commit everything together
git commit -m "🚀 Add new feature with changeset"

# Push your branch
git push -u origin feature/your-feature-name
```

### 2. Create Pull Request

- **Title**: Use the same emoji convention as commit messages
- **Description**: Explain what changed and why
- **Link issues**: Reference any related GitHub issues

### 3. Review Process

- ✅ **Automated tests** must pass
- ✅ **Type checking** must pass
- ✅ **Code review** from maintainers
- ✅ **Changeset included** (if modifying published packages)

### 4. Merge

Once approved, maintainers will merge your PR. The automated release workflow will handle:

- **Publishing packages** with version bumps (if changesets exist)
- **Creating release notes** from changeset summaries
- **Git tagging** for releases

## 🛠️ Common Development Tasks

### Working with Specific Packages

```bash
# Develop the core framework
pnpm --filter blaizejs dev

# Test the client package
pnpm --filter @blaizejs/client test

# Build a specific package
pnpm --filter @blaizejs/testing-utils build

# Run the playground app
pnpm --filter playground dev
```

### Adding Dependencies

```bash
# Add to a specific package
pnpm --filter blaizejs add zod

# Add dev dependency
pnpm --filter @blaizejs/client add -D vitest

# Add to root (for tooling)
pnpm add -D -w prettier
```

> ⚠️ **Important Note on Dependencies**
> Adding dependencies should be done carefully, especially for published packages. Consider the implications:
> - **Bundle size**: Each dependency increases package size for end users
> - **Security surface**: More dependencies = more potential vulnerabilities
> - **Maintenance burden**: Dependencies need updates and may introduce breaking changes
> - **Publishing complexity**: Dependencies affect install times and compatibility
> 
> **Before adding a dependency:**
> - ✅ Is this functionality critical and can't be implemented reasonably in-house?
> - ✅ Is the dependency well-maintained with recent updates?
> - ✅ Does it have minimal sub-dependencies?
> - ✅ Is it the smallest library that meets your needs?
>
> **Root-level dependencies** should be limited to development tooling only (ESLint, Prettier, Turborepo, etc.). While Turborepo documentation may suggest installing some packages at the root, this can create deployment and bundling complications. **Always install runtime dependencies at the package level** where they're actually used.
> When in doubt, discuss dependency additions in your PR or open an issue for discussion.

### Running Scripts Across Packages

```bash
# Run script in all packages
pnpm -r run build

# Run in packages matching pattern
pnpm --filter "@blaizejs/*" test
```

## 🎯 Package-Specific Guidelines

### Core Framework (`packages/blaize-core`)

- **Focus**: Server, routing, middleware, plugins
- **Testing**: Comprehensive unit and integration tests
- **Performance**: Consider HTTP/2 optimizations
- **API**: Maintain backward compatibility

### Client Package (`packages/blaize-client`)

- **Focus**: Type-safe API client generation
- **Testing**: Mock server responses for tests
- **Compatibility**: Ensure works in browser and Node.js
- **Types**: Full TypeScript inference

### Testing Utils (`packages/blaize-testing-utils`)

- **Focus**: Utilities for testing BlaizeJS applications
- **Testing**: Test the testing utilities themselves
- **API**: Simple, intuitive interface
- **Documentation**: Clear examples

## 📐 Code Standards

### TypeScript

- ✅ **Strict mode** enabled
- ✅ **Explicit types** for public APIs
- ✅ **Generic constraints** where appropriate
- ✅ **JSDoc comments** for public functions

### Testing

- ✅ **Vitest** for all testing
- ✅ **Unit tests** for individual functions
- ✅ **Integration tests** for workflows
- ✅ **Type testing** for TypeScript APIs

### Formatting & Linting

- ✅ **ESLint** for code quality
- ✅ **Prettier** for formatting
- ✅ **Auto-formatting** on save (VS Code config coming soon)

*Detailed coding standards documentation coming soon.*

## 📚 Documentation

### API Documentation

- **JSDoc comments** for all public APIs
- **README updates** for new features
- **Examples** in documentation

### Future: Documentation Website

We're planning a documentation website (`apps/docs`) that will follow a similar workflow:

- **Separate release workflow** (`release-docs`) for documentation deployments
- **No npm publishing** - deploys to hosting platform
- **Changeset-like workflow** for tracking documentation changes

*Documentation website workflow guide coming soon.*

## ❓ Getting Help

- 🐛 **Found a bug?** [Create an issue](https://github.com/jleajones/blaize/issues)
- 💬 **Questions?** [Start a discussion](https://github.com/jleajones/blaize/discussions)
- 📧 **Contact**: jason@careymarcel.com

## 🙏 Recognition

Contributors are recognized in:

- **Release notes** (from changeset summaries)
- **Package changelogs** (automatically generated)
- **GitHub contributors** section

Thank you for contributing to BlaizeJS! 🔥

---

*This contributing guide is updated regularly. Please check back for the latest information.*