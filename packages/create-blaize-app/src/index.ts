/**
 * BlaizeJS CLI - Create BlaizeJS applications with zero configuration
 */

import chalk from 'chalk';

import { install } from './commands/install';
import { parseArgs } from './commands/parse-args';
import { scaffold } from './commands/scaffold';
import { displaySuccess } from './commands/success';
import { validateInputs } from './commands/validate';
import { cleanupManager } from './utils/cleanup';
import { handleError, validateNodeVersion } from './utils/errors';
import { asyncPipe, unwrap, measureTime } from './utils/functional';

/**
 * Main CLI pipeline
 */
const createApp = asyncPipe(
  measureTime('Parsing arguments', (argv: string[]) => unwrap(parseArgs(argv))),
  measureTime('Validating inputs', async args => unwrap(await validateInputs(args))),
  measureTime('Scaffolding project', async inputs => unwrap(await scaffold(inputs))),
  measureTime('Installing dependencies', async context => unwrap(await install(context))),
  displaySuccess
);

/**
 * Run the CLI
 */
async function run() {
  try {
    // Validate Node.js version first
    validateNodeVersion();

    // Display header
    console.log(chalk.bold.cyan('\n🔥 BlaizeJS CLI\n'));

    // Run the pipeline
    await createApp(process.argv);

    // Clear cleanup tasks on success
    cleanupManager.clear();
  } catch (error) {
    // Handle errors gracefully
    await cleanupManager.cleanup();
    handleError(error);
  }
}

// Start the CLI
run();
