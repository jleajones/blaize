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
