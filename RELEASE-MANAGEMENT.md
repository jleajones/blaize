# 📦 Release Management

This document describes how releases work in BlaizeJS, including our automated workflow, changesets process, and troubleshooting common issues.

## 🔄 Release Workflow Overview

BlaizeJS uses **Changesets** with **GitHub Actions** for automated, coordinated releases across all published packages. Here's how it works:

```
1. 🔧 Developer creates feature branch
2. 📝 Developer adds changeset (if needed)
3. 🔀 PR is merged to main
4. 🤖 GitHub Action creates "Version Packages" PR
5. 👀 Maintainer reviews and merges "Version Packages" PR  
6. 🚀 GitHub Action automatically publishes to npm
7. 🏷️ Git tags are created for releases
```

## 📋 What Gets Released

### Published Packages

These packages are released to npm and require changesets:

- **`blaizejs`** - Core framework
- **`@blaizejs/client`** - Type-safe API client
- **`@blaizejs/testing-utils`** - Testing utilities

### Internal Packages

These are **not published** and don't need changesets:

- **`@blaizejs/types`** - Internal type definitions (bundled with core)
- **`apps/*`** - Documentation, examples, playground
- **`configs/*`** - Shared tooling configuration

## 🎯 Creating Changesets

### When to Create a Changeset

Create a changeset for **any change that affects published packages**:

- ✅ Bug fixes in core, client, or testing packages
- ✅ New features or API additions
- ✅ Performance improvements
- ✅ Breaking changes
- ✅ Documentation updates for APIs

### When NOT to Create a Changeset

- ❌ Workflow/CI configuration changes
- ❌ Internal tooling updates
- ❌ README updates (non-API documentation)
- ❌ Test-only changes
- ❌ Example app updates

### Creating a Changeset

```bash
# From your feature branch, after making changes
pnpm changeset
```

Follow the interactive prompts:

1. **Select packages**: Choose which packages your changes affect
2. **Choose bump type**:
   - **patch** (0.1.0 → 0.1.1) - Bug fixes, small improvements
   - **minor** (0.1.0 → 0.2.0) - New features, backward compatible
   - **major** (0.1.0 → 1.0.0) - Breaking changes
3. **Write summary**: Clear description for the changelog

### Changeset Examples

```bash
# Bug fix affecting core package
✅ Select: blaizejs
✅ Type: patch
✅ Summary: "Fix middleware execution order in plugin system"

# New feature affecting core and client
✅ Select: blaizejs, @blaizejs/client  
✅ Type: minor (for both)
✅ Summary: "Add WebSocket support with type-safe client integration"

# Breaking change in testing utils
✅ Select: @blaizejs/testing-utils
✅ Type: major
✅ Summary: "Refactor testing API for better TypeScript support"
```

## 🤖 Automated Release Process

### GitHub Actions Workflow

Our release process uses two GitHub Actions:

#### 1. Test Workflow (`.github/workflows/test.yml`)
- **Triggers**: PRs and pushes to main/develop
- **Purpose**: Runs tests, type checking, and linting
- **Branch Protection**: Required to pass before merging

#### 2. Release Workflow (`.github/workflows/release.yml`)
- **Triggers**: Pushes to main branch
- **Purpose**: Creates "Version Packages" PRs and publishes releases

### The "Version Packages" PR

When you merge a PR with changesets to main:

1. **GitHub Action runs** and analyzes all accumulated changesets
2. **Creates/updates** a PR titled "Version Packages"
3. **PR contains**:
   - Version bumps in package.json files
   - Updated CHANGELOG.md files
   - Deleted changeset files (they're consumed)

#### Version Packages PR Behavior

- **Single PR**: Only one "Version Packages" PR exists at a time
- **Accumulates changes**: New changesets update the existing PR
- **Smart versioning**: Multiple changes pick the highest version bump
- **Auto-generated**: Branch name is `changeset-release/main`

### Publishing Process

When you **merge the "Version Packages" PR**:

1. **Builds all packages** with latest source code
2. **Runs full test suite** to ensure quality
3. **Publishes to npm** with new version numbers
4. **Creates git tags** for each released version
5. **Generates release notes** from changeset summaries

## 🔧 Configuration Details

### NPM Publishing

- **Registry**: npmjs.org
- **Access**: Public packages
- **Authentication**: NPM automation token (bypasses 2FA)
- **Scope**: `@blaizejs/` for scoped packages, `blaizejs` for core

### Branch Protection

- **Required checks**: Test workflow must pass
- **Status checks**: Automated tests, type checking, linting
- **Special handling**: "Version Packages" PRs can be merged by maintainers

### Permissions

GitHub Actions needs these permissions:
- **contents: write** - Create commits and tags
- **pull-requests: write** - Create and update PRs

## 🐛 Troubleshooting

### Common Issues

#### 1. Test Workflow Not Running on "Version Packages" PR

**Problem**: GitHub Actions doesn't trigger workflows on bot-created PRs by default.

**Solution**: Our test workflow includes specific configuration to run on bot PRs:
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch:
```

**Manual fix**: If needed, manually trigger the Test workflow from Actions tab.

#### 2. Publishing Fails with 2FA Error

**Problem**: 
```
error EOTP This operation requires a one-time password
```

**Solution**: 
1. Create automation token: `npm token create --type=automation`
2. Update GitHub secret `NPM_TOKEN` with the automation token
3. Re-run the failed workflow

#### 3. Permission Denied When Creating PRs

**Problem**:
```
remote: Permission denied to github-actions[bot]
```

**Solution**: Check repository settings:
- Settings → Actions → General → Workflow permissions
- ✅ "Read and write permissions"  
- ✅ "Allow GitHub Actions to create and approve pull requests"

#### 4. Version Packages PR Becomes Stale

**Problem**: New changesets merged while "Version Packages" PR exists.

**Solution**: 
1. Close the old "Version Packages" PR
2. New PR will be created automatically with all changes
3. Or merge the old PR quickly to avoid conflicts

#### 5. Build Fails During Publishing

**Problem**: Packages fail to build during release.

**Solution**:
1. Ensure `pnpm build` works locally
2. Check for missing dependencies
3. Verify TypeScript configuration
4. Re-run workflow after fixes

### Manual Recovery

If automated publishing fails, you can manually publish:

```bash
# Build all packages
pnpm build

# Publish individually (after version bumps are committed)
cd packages/blaize-core && npm publish
cd packages/blaize-client && npm publish  
cd packages/blaize-testing-utils && npm publish

# Create git tags manually
git tag blaizejs@0.2.1
git tag @blaizejs/client@0.2.1
git tag @blaizejs/testing-utils@0.1.3
git push --tags
```

## 📊 Release Monitoring

### Checking Release Status

```bash
# Check published versions
npm view blaizejs version
npm view @blaizejs/client version
npm view @blaizejs/testing-utils version

# Compare with local versions
pnpm list --depth=0
```

### Release Analytics

Monitor releases via:
- **GitHub Releases**: Auto-generated from git tags
- **npm download stats**: Track package adoption
- **Changelogs**: Review what was released when

## 🎯 Best Practices

### For Maintainers

#### Merging "Version Packages" PRs

1. **Review the changes**: Check version bumps make sense
2. **Verify changelogs**: Ensure changeset summaries are clear
3. **Test if needed**: Run additional tests for major releases
4. **Merge promptly**: Avoid conflicts with new changesets

#### Coordinating Releases

- **Batch related changes**: Let changesets accumulate for related features
- **Time releases**: Avoid releasing during weekends/holidays
- **Communicate**: Announce major releases to users
- **Monitor**: Watch for issues after releases

### For Contributors

#### Writing Good Changeset Summaries

```bash
# ✅ Good - Clear, actionable
"Fix route parameter parsing for dynamic routes with special characters"

# ✅ Good - Feature description
"Add WebSocket support with automatic reconnection and typing"

# ❌ Bad - Too vague
"Fix bug"

# ❌ Bad - Implementation details
"Update regex in router.ts line 45"
```

#### Managing Breaking Changes

For major version bumps:
1. **Document migration**: Include upgrade instructions
2. **Deprecation period**: Warn before removing features
3. **Clear changelog**: Explain what breaks and why

## 🔮 Future Enhancements

### Planned Improvements

- **Documentation releases**: Separate workflow for docs website
- **Release candidates**: Beta/RC versions for testing
- **Automated testing**: Enhanced integration tests before publishing
- **Release notifications**: Discord/Slack notifications for releases

### Documentation Website Releases

Coming soon - separate workflow for `apps/docs`:
- **No npm publishing** - deploys to hosting platform
- **Separate versioning** - documentation versions independent of packages
- **Preview deployments** - Test documentation changes before release

---

## 📞 Support

Having trouble with releases?

- 🐛 **Issues**: [GitHub Issues](https://github.com/jleajones/blaize/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/jleajones/blaize/discussions)
- 📧 **Contact**: jason@careymarcel.com

---

*This release management guide reflects our current automated workflow. It will be updated as our processes evolve.*