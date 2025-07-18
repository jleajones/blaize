import * as os from 'node:os';

import { processChangedFile } from './cache';
import { findRouteFiles } from './finder';

import type { Route } from '@blaize-types/router';

export async function processFilesInParallel(
  filePaths: string[],
  processor: (filePath: string) => Promise<Route[]>,
  concurrency: number = Math.max(1, Math.floor(os.cpus().length / 2))
): Promise<Route[][]> {
  const chunks = chunkArray(filePaths, concurrency);
  const results: Route[][] = [];

  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(chunk.map(filePath => processor(filePath)));

    const successfulResults = chunkResults
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<Route[]>).value);

    results.push(...successfulResults);
  }

  return results;
}

export async function loadInitialRoutesParallel(routesDir: string): Promise<Route[]> {
  const files = await findRouteFiles(routesDir);
  const routeArrays = await processFilesInParallel(files, filePath =>
    processChangedFile(filePath, routesDir)
  );

  return routeArrays.flat();
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
