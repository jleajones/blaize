/**
 * Basic BlaizeJS Server Example
 *
 * This is a minimal example showing how to create and start a BlaizeJS server.
 * Currently, it will throw an error since the implementation is not complete.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';


import Blaize from '@/index.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Eventually this example will create and start a simple server
try {
  console.log(`BlaizeJS version: ${Blaize.VERSION}`);
  // Resolve the routes directory path relative to this file
  const routesDir = path.resolve(__dirname, './router/');

  // This will throw an error since the implementation is not yet available
  const app = Blaize.createServer({
    port: 3000,
    host: 'localhost',
    routesDir,
  });
  // Start the server
  await app.listen();
} catch (err) {
  console.error('Error:', err);
}

