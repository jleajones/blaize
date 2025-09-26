import { createClient } from './client';
import { version } from '../package.json';
import {
  fibonacciBackoff,
  fixedDelay,
  linearBackoff,
  exponentialBackoff,
} from './sse-reconnection-strategies';

const bc = {
  create: createClient,
  version,
  fibonacciBackoff,
  fixedDelay,
  linearBackoff,
  exponentialBackoff,
};
export default bc;
