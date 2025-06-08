import { createClient } from './client';
export const blaizeClientVersion = '0.1.0';

const bc = {
  create: createClient,
  version: blaizeClientVersion,
};
export default bc;
