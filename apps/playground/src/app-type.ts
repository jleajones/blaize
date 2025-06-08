import { getHello, postHello } from './routes/hello.js';

export const routes = {
  getHello,
  postHello,
} as const;
