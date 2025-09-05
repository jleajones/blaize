
/**
 * Configuration for the correlation ID system
 * @internal
 */
export interface CorrelationConfig {
  headerName: string;
  generator: () => string;
}