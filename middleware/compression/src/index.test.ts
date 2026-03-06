import { describe, it, expect } from 'vitest';
import { CompressionConfigurationError } from './index';

describe('@blaizejs/middleware-compression', () => {
  it('should export CompressionConfigurationError', () => {
    expect(CompressionConfigurationError).toBeDefined();
    expect(typeof CompressionConfigurationError).toBe('function');
  });

  it('should allow instantiating CompressionConfigurationError', () => {
    const error = new CompressionConfigurationError('test', 'field');
    expect(error).toBeInstanceOf(CompressionConfigurationError);
    expect(error).toBeInstanceOf(Error);
  });
});

