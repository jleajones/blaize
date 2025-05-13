// packages/blaizejs/src/context/index.ts

// Export types that users of the module will need
export type {
  Context,
  ContextRequest,
  ContextResponse,
  ContextOptions,
  State,
  RequestParams,
  QueryParams,
  StreamOptions,
  UnifiedRequest,
  UnifiedResponse,
} from './types';

// Export store functionality
export { getContext, runWithContext, bindContext, hasContext } from './store';

// Export context creation
export { createContext } from './create';

// Export state management
export {
  getState,
  setState,
  removeState,
  getStateMany,
  setStateMany,
  createNamespacedState,
  createTypedState,
} from './state';

// Export contextMiddleware to be used in the middleware pipeline
export { contextMiddleware } from './store';
