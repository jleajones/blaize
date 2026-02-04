import boxen from 'boxen';
import chalk from 'chalk';

import { getRunCommand } from '../utils/package-manager';

import type { InstallResult } from '@/types';

/**
 * Get template-specific information for success message
 */
const getTemplateInfo = (templateName: string) => {
  if (templateName === 'advanced') {
    return {
      description: 'Advanced template with Redis, Queue, Cache, and Metrics plugins',
      features: [
        '🔥 Redis-powered EventBus, Queue, Cache, and Metrics',
        '🐳 Docker Compose with Redis and Redis Commander',
        '📊 Production-ready plugin architecture',
        '🧪 Integration tests with Redis',
        '📈 Performance monitoring and metrics',
      ],
      endpoints: [
        { method: 'GET', path: 'https://localhost:7485/', desc: 'Welcome message' },
        { method: 'GET', path: 'https://localhost:7485/health', desc: 'Health check' },
        { method: 'GET', path: 'https://localhost:7485/cache/dashboard', desc: 'Cache dashboard' },
        { method: 'GET', path: 'https://localhost:7485/queue/stats', desc: 'Queue statistics' },
        { method: 'GET', path: 'https://localhost:7485/metrics', desc: 'Metrics endpoint' },
      ],
      extraSteps: [{ label: 'Start Redis', command: 'docker compose up -d' }],
      tips: [
        '• Start Redis with Docker Compose before running the server',
        '• Check Redis Commander at http://localhost:8081 (docker compose --profile gui up -d)',
        '• The server runs on https://localhost:7485 by default',
        '• All plugins publish events to EventBus automatically',
        '• Integration tests require Redis to be running',
      ],
    };
  }

  // Default: minimal template
  return {
    description: 'Minimal template with core BlaizeJS features',
    features: [
      '🚀 File-based routing with automatic discovery',
      '📝 Type-safe file uploads with Zod schemas',
      '🔄 Server-Sent Events (SSE) for real-time streaming',
      '📡 EventBus for publish/subscribe patterns',
      '🧪 Comprehensive test suite (30 tests, 80%+ coverage)',
    ],
    endpoints: [
      { method: 'GET', path: 'https://localhost:7485/', desc: 'Welcome message' },
      { method: 'GET', path: 'https://localhost:7485/health', desc: 'Health check' },
      { method: 'GET', path: 'https://localhost:7485/users', desc: 'List users' },
      { method: 'GET', path: 'https://localhost:7485/users/:userId', desc: 'Get user' },
      { method: 'POST', path: 'https://localhost:7485/upload', desc: 'File upload' },
      { method: 'GET', path: 'https://localhost:7485/events/stream', desc: 'SSE stream' },
    ],
    extraSteps: [],
    tips: [
      '• Copy .env.example to .env before running',
      '• The .env file is gitignored for security',
      '• Set NODE_ENV=development to enable SSL cert generation',
      '• The server runs on https://localhost:7485 by default',
      '• Hot reload is enabled in development mode',
      '• Modify src/routes/ to add new API endpoints',
    ],
  };
};

/**
 * Display success message with next steps
 */
export const displaySuccess = (context: InstallResult): InstallResult => {
  const { name: projectName, packageManager, installSkipped, dryRun, template } = context;

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

  // Get template-specific information
  const templateInfo = getTemplateInfo(template.name);

  // Project info
  console.log(chalk.bold('📁 Project:'), chalk.cyan(projectName));
  console.log(chalk.bold('📦 Package Manager:'), chalk.cyan(packageManager));
  console.log(chalk.bold('🎯 Template:'), chalk.cyan(template.name));
  console.log(chalk.gray(`   ${templateInfo.description}`));

  // Calculate total time if available
  if (context.installDuration) {
    console.log(chalk.bold('⏱️  Installation Time:'), chalk.cyan(`${context.installDuration}s`));
  }

  // Features
  console.log(chalk.bold('\n✨ Features:\n'));
  templateInfo.features.forEach(feature => {
    console.log(`  ${feature}`);
  });

  // Next steps
  console.log(chalk.bold('\n🚀 Next steps:\n'));

  const steps: Array<[string, string]> = [
    ['Navigate to project', `cd ${projectName}`],
    ['Copy environment template', 'cp .env.example .env'],
  ];

  // Add template-specific steps
  templateInfo.extraSteps.forEach(step => {
    steps.push([step.label, step.command]);
  });

  if (installSkipped) {
    steps.push(['Install dependencies', getRunCommand(packageManager, 'install')]);
  }

  steps.push(
    ['Start development server', getRunCommand(packageManager, 'dev')],
    ['Run tests', getRunCommand(packageManager, 'test')],
    ['Build for production', getRunCommand(packageManager, 'build')]
  );

  steps.forEach(([label, command], index) => {
    console.log(chalk.gray(`  ${index + 1}.`) + ` ${label}:`);
    console.log(`     ${chalk.cyan(command)}\n`);
  });

  // Project structure (generic)
  console.log(chalk.bold('📂 Project structure:\n'));
  console.log(chalk.gray('  src/'));
  console.log(chalk.gray('  ├── app.ts           # Server setup'));
  console.log(chalk.gray('  ├── app-router.ts    # Route factory'));
  console.log(chalk.gray('  └── routes/          # API routes'));

  if (template.name === 'advanced') {
    console.log(chalk.gray('  ├── docker-compose.yml # Redis setup'));
    console.log(chalk.gray('  └── .env.example      # Environment config\n'));
  } else {
    console.log(chalk.gray('  └── .env.example      # Environment config\n'));
  }

  // Available endpoints (template-specific)
  console.log(chalk.bold('🔗 Available endpoints:\n'));
  templateInfo.endpoints.forEach(({ method, path, desc }) => {
    const methodColor =
      method === 'GET' ? chalk.green : method === 'POST' ? chalk.yellow : chalk.blue;
    console.log(`  ${methodColor(method.padEnd(4))} ${chalk.cyan(path.padEnd(45))} # ${desc}`);
  });
  console.log('');

  // Resources
  console.log(chalk.bold('📚 Resources:\n'));
  console.log('  📖 Documentation:', chalk.blue('https://github.com/jleajones/blaize'));
  console.log('  🐛 Report issues:', chalk.blue('https://github.com/jleajones/blaize/issues'));
  console.log('  💬 Discord:', chalk.blue('https://discord.gg/blaizejs\n'));

  // Tips (template-specific)
  console.log(chalk.bold('💡 Tips:\n'));
  templateInfo.tips.forEach(tip => {
    console.log(`  ${tip}`);
  });
  console.log(
    '\n  • Run',
    chalk.cyan(getRunCommand(packageManager, 'test:coverage')),
    'to see test coverage'
  );

  console.log(chalk.gray('\n' + '─'.repeat(70)));
  console.log(chalk.bold.green('\nHappy coding! 🔥\n'));

  return context;
};
