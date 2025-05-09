import { Options } from 'tsup';

/**
 * Creates a tsup configuration with BlaizeJS defaults
 * 
 * @param options - Custom tsup options to merge with defaults
 * @returns A tsup configuration object
 */
export function createTsupConfig(options?: Options): Options;

/**
 * Default tsup configuration for BlaizeJS
 */
declare const defaultConfig: Options;

export default defaultConfig;