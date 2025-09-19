import {
  BackpressureConfigSchema,
  BufferStrategySchema,
  WatermarkConfigSchema,
  SizeLimitsSchema,
  createDefaultConfig,
  validateConfig,
  isValidStrategy,
  isValidWatermarks,
  isValidConfig,
  type BackpressureConfig,
} from './back-pressure';

describe('Backpressure Types', () => {
  describe('BufferStrategySchema', () => {
    it('should accept valid strategies', () => {
      expect(BufferStrategySchema.parse('drop-oldest')).toBe('drop-oldest');
      expect(BufferStrategySchema.parse('drop-newest')).toBe('drop-newest');
      expect(BufferStrategySchema.parse('close')).toBe('close');
    });

    it('should reject invalid strategies', () => {
      expect(() => BufferStrategySchema.parse('invalid')).toThrow();
      expect(() => BufferStrategySchema.parse(123)).toThrow();
      expect(() => BufferStrategySchema.parse(null)).toThrow();
    });
  });

  describe('WatermarkConfigSchema', () => {
    it('should accept valid watermarks', () => {
      const valid = { low: 100, high: 1000 };
      expect(WatermarkConfigSchema.parse(valid)).toEqual(valid);
    });

    it('should reject invalid watermarks', () => {
      // Low >= high
      expect(() => WatermarkConfigSchema.parse({ low: 1000, high: 100 })).toThrow();
      expect(() => WatermarkConfigSchema.parse({ low: 100, high: 100 })).toThrow();

      // Negative values
      expect(() => WatermarkConfigSchema.parse({ low: -1, high: 100 })).toThrow();
      expect(() => WatermarkConfigSchema.parse({ low: 10, high: -100 })).toThrow();

      // Non-integers
      expect(() => WatermarkConfigSchema.parse({ low: 10.5, high: 100 })).toThrow();

      // Missing fields
      expect(() => WatermarkConfigSchema.parse({ low: 10 })).toThrow();
      expect(() => WatermarkConfigSchema.parse({ high: 100 })).toThrow();
    });
  });

  describe('SizeLimitsSchema', () => {
    it('should accept valid size limits', () => {
      expect(SizeLimitsSchema.parse({ maxMessages: 5000 })).toEqual({
        maxMessages: 5000,
      });

      expect(
        SizeLimitsSchema.parse({
          maxMessages: 5000,
          maxBytes: 1024 * 1024,
          messageTimeout: 30000,
        })
      ).toEqual({
        maxMessages: 5000,
        maxBytes: 1024 * 1024,
        messageTimeout: 30000,
      });
    });

    it('should reject invalid size limits', () => {
      // Exceeds max
      expect(() => SizeLimitsSchema.parse({ maxMessages: 100001 })).toThrow();
      expect(() =>
        SizeLimitsSchema.parse({
          maxMessages: 1000,
          maxBytes: 101 * 1024 * 1024,
        })
      ).toThrow();

      // Zero or negative
      expect(() => SizeLimitsSchema.parse({ maxMessages: 0 })).toThrow();
      expect(() => SizeLimitsSchema.parse({ maxMessages: -100 })).toThrow();

      // Invalid timeout
      expect(() =>
        SizeLimitsSchema.parse({
          maxMessages: 1000,
          messageTimeout: -1,
        })
      ).toThrow();
      expect(() =>
        SizeLimitsSchema.parse({
          maxMessages: 1000,
          messageTimeout: 300001,
        })
      ).toThrow();
    });
  });

  describe('BackpressureConfigSchema', () => {
    it('should provide sensible defaults', () => {
      const config = BackpressureConfigSchema.parse({});
      expect(config).toEqual({
        enabled: true,
        strategy: 'drop-oldest',
        watermarks: { low: 100, high: 1000 },
        limits: { maxMessages: 10000 },
      });
    });

    it('should accept complete valid config', () => {
      const config: BackpressureConfig = {
        enabled: true,
        strategy: 'drop-oldest',
        watermarks: { low: 50, high: 500 },
        limits: {
          maxMessages: 5000,
          maxBytes: 1024 * 1024,
          messageTimeout: 10000,
        },
        metrics: {
          enabled: true,
          interval: 10000,
        },
      };

      expect(BackpressureConfigSchema.parse(config)).toEqual(config);
    });

    it('should reject watermarks exceeding limits', () => {
      expect(() =>
        BackpressureConfigSchema.parse({
          watermarks: { low: 100, high: 2000 },
          limits: { maxMessages: 1000 },
        })
      ).toThrow(/High watermark cannot exceed maxMessages/);
    });

    it('should handle partial overrides', () => {
      const config = BackpressureConfigSchema.parse({
        strategy: 'drop-newest',
        watermarks: { low: 200, high: 2000 },
      });

      expect(config.strategy).toBe('drop-newest');
      expect(config.watermarks).toEqual({ low: 200, high: 2000 });
      expect(config.enabled).toBe(true); // default
      expect(config.limits.maxMessages).toBe(10000); // default
    });
  });

  describe('createDefaultConfig', () => {
    it('should create default config', () => {
      const config = createDefaultConfig();
      expect(config.enabled).toBe(true);
      expect(config.strategy).toBe('drop-oldest');
      expect(config.watermarks).toEqual({ low: 100, high: 1000 });
    });

    it('should apply overrides', () => {
      const config = createDefaultConfig({
        strategy: 'drop-oldest',
        watermarks: { low: 50, high: 500 },
      });

      expect(config.strategy).toBe('drop-oldest');
      expect(config.watermarks).toEqual({ low: 50, high: 500 });
      expect(config.enabled).toBe(true); // still default
    });

    it('should validate overrides', () => {
      expect(() =>
        createDefaultConfig({
          watermarks: { low: 1000, high: 100 },
        })
      ).toThrow();
    });
  });

  describe('validateConfig', () => {
    it('should return success for valid config', () => {
      const result = validateConfig({
        strategy: 'drop-newest',
        watermarks: { low: 10, high: 100 },
        limits: { maxMessages: 1000 },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strategy).toBe('drop-newest');
      }
    });

    it('should return detailed errors for invalid config', () => {
      const result = validateConfig({
        strategy: 'invalid',
        watermarks: { low: 1000, high: 100 },
        limits: { maxMessages: -10 },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain(
          "strategy: Invalid enum value. Expected 'drop-oldest' | 'drop-newest' | 'close', received 'invalid'"
        );
        expect(
          result.errors.some(e => e.includes('Low watermark must be less than high watermark'))
        ).toBe(true);
        expect(result.errors.some(e => e.includes('maxMessages'))).toBe(true);
      }
    });

    it('should handle nested path errors', () => {
      const result = validateConfig({
        watermarks: { low: 'invalid', high: 100 },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.startsWith('watermarks.low:'))).toBe(true);
      }
    });
  });

  describe('Type guards', () => {
    it('isValidStrategy should check buffer strategies', () => {
      expect(isValidStrategy('drop-oldest')).toBe(true);
      expect(isValidStrategy('drop-newest')).toBe(true);
      expect(isValidStrategy('invalid')).toBe(false);
      expect(isValidStrategy(123)).toBe(false);
      expect(isValidStrategy(null)).toBe(false);
    });

    it('isValidWatermarks should check watermark config', () => {
      expect(isValidWatermarks({ low: 10, high: 100 })).toBe(true);
      expect(isValidWatermarks({ low: 100, high: 10 })).toBe(false);
      expect(isValidWatermarks({ low: 10 })).toBe(false);
      expect(isValidWatermarks('invalid')).toBe(false);
    });

    it('isValidConfig should check complete config', () => {
      expect(
        isValidConfig({
          enabled: true,
          strategy: 'drop-oldest',
          watermarks: { low: 10, high: 100 },
          limits: { maxMessages: 1000 },
        })
      ).toBe(true);

      expect(
        isValidConfig({
          strategy: 'invalid',
        })
      ).toBe(false);

      expect(isValidConfig(null)).toBe(false);
      expect(isValidConfig('string')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle boundary values', () => {
      // Max allowed values
      expect(() =>
        SizeLimitsSchema.parse({
          maxMessages: 100000,
          maxBytes: 100 * 1024 * 1024,
          messageTimeout: 300000,
        })
      ).not.toThrow();

      // Just over max
      expect(() =>
        SizeLimitsSchema.parse({
          maxMessages: 100001,
        })
      ).toThrow();
    });

    it('should handle empty objects with defaults', () => {
      const config = BackpressureConfigSchema.parse({});
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
    });

    it('should handle complex validation chains', () => {
      // High watermark at limit, should pass
      expect(() =>
        BackpressureConfigSchema.parse({
          watermarks: { low: 900, high: 1000 },
          limits: { maxMessages: 1000 },
        })
      ).not.toThrow();

      // High watermark over limit, should fail
      expect(() =>
        BackpressureConfigSchema.parse({
          watermarks: { low: 900, high: 1001 },
          limits: { maxMessages: 1000 },
        })
      ).toThrow();
    });
  });
});
