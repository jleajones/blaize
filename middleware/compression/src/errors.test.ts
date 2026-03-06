import { describe, it, expect } from 'vitest';
import { BlaizeError, ErrorType } from '@blaize-types/errors';

import { CompressionConfigurationError } from './errors';

describe('CompressionConfigurationError', () => {
  it('should have correct type', () => {
    const error = new CompressionConfigurationError('Invalid algorithm', 'algorithm');
    expect(error.type).toBe(ErrorType.COMPRESSION_CONFIGURATION_ERROR);
  });

  it('should have status 500', () => {
    const error = new CompressionConfigurationError('Invalid threshold', 'threshold');
    expect(error.status).toBe(500);
  });

  it('should have correct name', () => {
    const error = new CompressionConfigurationError('Bad config', 'level');
    expect(error.name).toBe('CompressionConfigurationError');
  });

  it('should include field in details', () => {
    const error = new CompressionConfigurationError('Invalid value', 'memoryLevel');
    expect(error.details).toEqual({ field: 'memoryLevel' });
  });

  it('should use provided correlationId', () => {
    const error = new CompressionConfigurationError('Bad config', 'level', 'test-correlation-123');
    expect(error.correlationId).toBe('test-correlation-123');
  });

  it('should auto-populate correlationId when not provided', () => {
    const error = new CompressionConfigurationError('Bad config', 'level');
    expect(error.correlationId).toBeDefined();
    expect(typeof error.correlationId).toBe('string');
    expect(error.correlationId.length).toBeGreaterThan(0);
  });

  it('should be an instance of CompressionConfigurationError', () => {
    const error = new CompressionConfigurationError('Bad config', 'level');
    expect(error).toBeInstanceOf(CompressionConfigurationError);
  });

  it('should be an instance of BlaizeError', () => {
    const error = new CompressionConfigurationError('Bad config', 'level');
    expect(error).toBeInstanceOf(BlaizeError);
  });

  it('should be an instance of Error', () => {
    const error = new CompressionConfigurationError('Bad config', 'level');
    expect(error).toBeInstanceOf(Error);
  });

  it('should set message from title', () => {
    const error = new CompressionConfigurationError('Invalid algorithm specified', 'algorithm');
    expect(error.message).toBe('Invalid algorithm specified');
    expect(error.title).toBe('Invalid algorithm specified');
  });
});

