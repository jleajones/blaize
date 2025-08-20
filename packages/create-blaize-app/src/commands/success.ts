import boxen from 'boxen';
import chalk from 'chalk';

import { getRunCommand } from '../utils/package-manager';

import type { InstallResult } from './install';

/**
 * Display success message with next steps
 */
export const displaySuccess = (context: InstallResult): InstallResult => {
  const { name: projectName, packageManager, installSkipped, dryRun } = context;

  console.log('\n');

  // Success banner
  const title = dryRun
    ? chalk.bold.blue('🔍 Dry run completed successfully!')
    : chalk.bold.green('✨ Project created successfully!');

  console.log(
    boxen(title, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: dryRun ? 'blue' : 'green',
    })
  );

  if (dryRun) {
    console.log(chalk.blue('No files were created. Remove --dry-run to create the project.\n'));
    return context;
  }

  // Project info
  console.log(chalk.bold('📁 Project:'), chalk.cyan(projectName));
  console.log(chalk.bold('📦 Package Manager:'), chalk.cyan(packageManager));

  // Calculate total time if available
  if (context.installDuration) {
    console.log(chalk.bold('⏱️  Installation Time:'), chalk.cyan(`${context.installDuration}s`));
  }

  // Next steps
  console.log(chalk.bold('\n🚀 Next steps:\n'));

  const steps: Array<[string, string]> = [['Navigate to project', `cd ${projectName}`]];

  if (installSkipped) {
    steps.push(['Install dependencies', getRunCommand(packageManager, 'install')]);
  }

  steps.push(
    ['Start development server', getRunCommand(packageManager, 'dev')],
    ['Run tests', getRunCommand(packageManager, 'test')],
    ['Watch tests', getRunCommand(packageManager, 'test:watch')],
    ['Type check', getRunCommand(packageManager, 'type-check')],
    ['Build for production', getRunCommand(packageManager, 'build')]
  );

  steps.forEach(([label, command], index) => {
    console.log(chalk.gray(`  ${index + 1}.`) + ` ${label}:`);
    console.log(`     ${chalk.cyan(command)}\n`);
  });

  // Project structure
  console.log(chalk.bold('📂 Project structure:\n'));
  console.log(chalk.gray('  src/'));
  console.log(chalk.gray('  ├── app.ts           # Server setup'));
  console.log(chalk.gray('  ├── routes/          # API routes'));
  console.log(chalk.gray('  │   ├── index.ts     # Root endpoint'));
  console.log(chalk.gray('  │   └── health.ts    # Health check'));
  console.log(chalk.gray('  └── __tests__/       # Test files'));
  console.log(chalk.gray('      └── routes/      # Route tests\n'));

  // Available endpoints
  console.log(chalk.bold('🔗 Available endpoints:\n'));
  console.log('  GET', chalk.cyan('http://localhost:3000/'), '      # Welcome message');
  console.log('  GET', chalk.cyan('http://localhost:3000/health'), '# Health check\n');

  // Resources
  console.log(chalk.bold('📚 Resources:\n'));
  console.log('  📖 Documentation:', chalk.blue('https://github.com/jleajones/blaize'));
  console.log('  🐛 Report issues:', chalk.blue('https://github.com/jleajones/blaize/issues'));
  console.log('  💬 Discord:', chalk.blue('https://discord.gg/blaizejs\n'));

  // Tips
  console.log(chalk.bold('💡 Tips:\n'));
  console.log(
    '  • Run',
    chalk.cyan(getRunCommand(packageManager, 'test:coverage')),
    'to see test coverage'
  );
  console.log('  • The server runs on', chalk.cyan('http://localhost:3000'), 'by default');
  console.log('  • Hot reload is enabled in development mode');
  console.log('  • Check out the example tests to learn testing patterns');
  console.log('  • Modify', chalk.cyan('src/routes/'), 'to add new API endpoints\n');

  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.bold.green('\nHappy coding! 🔥\n'));

  return context;
};
