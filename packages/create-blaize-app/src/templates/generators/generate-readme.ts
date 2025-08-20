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
