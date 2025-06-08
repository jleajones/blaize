import { getUserRoute, postUserRoute } from './router/user/[userId]/index';

export const routes = {
  getUserRoute,
  postUserRoute,
} as const;
