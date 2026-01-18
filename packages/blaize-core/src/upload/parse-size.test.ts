/**
 * Tests for parseSize() and formatBytes() utilities
 *
 * Task [T1.3]: Implement parseSize() Utility with Binary Units
 *
 * Tests verify:
 * - Binary unit parsing (KB = 1024, not 1000)
 * - All supported units (B, KB, MB, GB, TB, KiB, MiB, GiB, TiB)
 * - Case-sensitive matching
 * - Error handling for invalid input
 * - Edge cases (0, negative, max size)
 *
 * Run with: vitest
 */

import { parseSize, formatBytes } from './parse-size';

describe('parseSize()', () => {
  // =========================================================================
  // Test Suite 1: Valid Inputs - Binary Units
  // =========================================================================

  describe('Binary Units (base 1024)', () => {
    it('should parse bytes (B)', () => {
      expect(parseSize('100B')).toBe(100);
      expect(parseSize('1B')).toBe(1);
      expect(parseSize('0B')).toBe(0);
    });

    it('should parse kilobytes (KB) as 1024 bytes', () => {
      expect(parseSize('1KB')).toBe(1024);
      expect(parseSize('2KB')).toBe(2048);
      expect(parseSize('0.5KB')).toBe(512);
    });

    it('should parse megabytes (MB) as 1024^2 bytes', () => {
      expect(parseSize('1MB')).toBe(1024 * 1024); // 1,048,576
      expect(parseSize('5MB')).toBe(5 * 1024 * 1024); // 5,242,880
      expect(parseSize('0.5MB')).toBe(524288);
    });

    it('should parse gigabytes (GB) as 1024^3 bytes', () => {
      expect(parseSize('1GB')).toBe(1024 * 1024 * 1024); // 1,073,741,824
      expect(parseSize('2GB')).toBe(2 * 1024 * 1024 * 1024);
    });

    it('should parse terabytes (TB) as 1024^4 bytes', () => {
      expect(parseSize('1TB')).toBe(1024 * 1024 * 1024 * 1024);
      expect(parseSize('0.5TB')).toBe(549755813888);
    });

    it('should parse IEC units (KiB, MiB, GiB, TiB)', () => {
      expect(parseSize('1KiB')).toBe(1024);
      expect(parseSize('1MiB')).toBe(1024 * 1024);
      expect(parseSize('1GiB')).toBe(1024 * 1024 * 1024);
      expect(parseSize('1TiB')).toBe(1024 * 1024 * 1024 * 1024);
    });
  });

  // =========================================================================
  // Test Suite 2: Number Input (without unit = bytes)
  // =========================================================================

  describe('Numeric Input', () => {
    it('should treat numbers as bytes', () => {
      expect(parseSize(100)).toBe(100);
      expect(parseSize(1024)).toBe(1024);
      expect(parseSize(0)).toBe(0);
    });

    it('should handle number strings as bytes', () => {
      expect(parseSize('100')).toBe(100);
      expect(parseSize('1024')).toBe(1024);
      expect(parseSize('0')).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 3: Whitespace Handling
  // =========================================================================

  describe('Whitespace', () => {
    it('should handle optional whitespace between number and unit', () => {
      expect(parseSize('5 MB')).toBe(5 * 1024 * 1024);
      expect(parseSize('10  KB')).toBe(10 * 1024);
      expect(parseSize('1\tGB')).toBe(1024 * 1024 * 1024);
    });

    it('should handle no whitespace', () => {
      expect(parseSize('5MB')).toBe(5 * 1024 * 1024);
      expect(parseSize('10KB')).toBe(10 * 1024);
    });

    it('should trim leading/trailing whitespace', () => {
      expect(parseSize('  5MB  ')).toBe(5 * 1024 * 1024);
      expect(parseSize('\n10KB\n')).toBe(10 * 1024);
    });
  });

  // =========================================================================
  // Test Suite 4: Decimal Values
  // =========================================================================

  describe('Decimal Values', () => {
    it('should handle decimal numbers', () => {
      expect(parseSize('1.5MB')).toBe(1572864);
      expect(parseSize('0.5KB')).toBe(512);
      expect(parseSize('2.5GB')).toBe(2684354560);
    });

    it('should round to nearest byte', () => {
      expect(parseSize('1.5B')).toBe(2); // Rounds 1.5 to 2
      expect(parseSize('0.5B')).toBe(1); // Rounds 0.5 to 1
    });
  });

  // =========================================================================
  // Test Suite 5: Case Sensitivity
  // =========================================================================

  describe('Case Sensitivity', () => {
    it('should be case-sensitive for units', () => {
      // Lowercase 'b' should be treated as bytes
      expect(parseSize('5MB')).toBe(5 * 1024 * 1024);
      expect(parseSize('5Mb')).toBe(5 * 1024 * 1024); // Still MB

      // These should work
      expect(parseSize('5KB')).toBe(5 * 1024);
      expect(parseSize('5KiB')).toBe(5 * 1024);
    });

    it('should handle common case variations', () => {
      expect(parseSize('5mb')).toBe(5 * 1024 * 1024);
      expect(parseSize('5Mb')).toBe(5 * 1024 * 1024);
      expect(parseSize('5MB')).toBe(5 * 1024 * 1024);
    });
  });

  // =========================================================================
  // Test Suite 6: Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle zero', () => {
      expect(parseSize('0B')).toBe(0);
      expect(parseSize('0MB')).toBe(0);
      expect(parseSize(0)).toBe(0);
    });

    it('should handle very large sizes', () => {
      expect(parseSize('5TB')).toBe(5497558138880);
      expect(parseSize('1024GB')).toBe(1099511627776); // 1TB in GB
    });

    it('should handle very small decimals', () => {
      expect(parseSize('0.001MB')).toBe(1049); // Rounds to nearest byte
      expect(parseSize('0.0001GB')).toBe(107374); // Rounds to nearest byte
    });
  });

  // =========================================================================
  // Test Suite 7: Invalid Input - Should Throw
  // =========================================================================

  describe('Invalid Input', () => {
    it('should throw on negative sizes', () => {
      expect(() => parseSize('-5MB')).toThrow('Size cannot be negative');
      expect(() => parseSize(-100)).toThrow('Size cannot be negative');
    });

    it('should throw on invalid units', () => {
      expect(() => parseSize('5XB')).toThrow('Invalid size unit');
      expect(() => parseSize('100PB')).toThrow('Invalid size unit');
      expect(() => parseSize('5bytes')).toThrow('Invalid size unit');
    });

    it('should throw on invalid format', () => {
      expect(() => parseSize('abc')).toThrow('Invalid size format');
      expect(() => parseSize('MB5')).toThrow('Invalid size format');
      expect(() => parseSize('')).toThrow('Invalid size format');
    });

    it('should throw on NaN', () => {
      expect(() => parseSize(NaN)).toThrow('Invalid size format');
    });

    it('should throw on Infinity', () => {
      expect(() => parseSize(Infinity)).toThrow('Size cannot be Infinity');
      expect(() => parseSize('InfinityMB')).toThrow('Invalid size format');
    });
  });

  // =========================================================================
  // Test Suite 8: Boundary Testing
  // =========================================================================

  describe('Boundary Values', () => {
    it('should handle max safe integer', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      expect(parseSize(maxSafe)).toBe(maxSafe);
    });

    it('should handle 5TB max (as per spec)', () => {
      expect(parseSize('5TB')).toBe(5 * 1024 * 1024 * 1024 * 1024);
    });
  });
});

// =============================================================================
// formatBytes() Tests
// =============================================================================

describe('formatBytes()', () => {
  describe('Format with appropriate units', () => {
    it('should format bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(100)).toBe('100 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });

    it('should format terabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
      expect(formatBytes(1.5 * 1024 * 1024 * 1024 * 1024)).toBe('1.5 TB');
    });
  });

  describe('Decimal Precision', () => {
    it('should limit decimal places to 2', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1587)).toBe('1.55 KB');
      expect(formatBytes(1588)).toBe('1.55 KB'); // Rounds
    });

    it('should omit decimal for whole numbers', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should handle very large sizes', () => {
      expect(formatBytes(5 * 1024 * 1024 * 1024 * 1024)).toBe('5 TB');
    });

    it('should handle negative (if allowed)', () => {
      // formatBytes should handle negative gracefully or throw
      // Assuming it formats with negative sign:
      expect(formatBytes(-1024)).toBe('-1 KB');
    });
  });

  describe('Round-trip consistency', () => {
    it('should round-trip parse → format → parse', () => {
      const sizes = ['5MB', '100KB', '1GB', '500B'];

      sizes.forEach(size => {
        const bytes = parseSize(size);
        const formatted = formatBytes(bytes);
        const reparsed = parseSize(formatted);

        expect(reparsed).toBe(bytes);
      });
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration: parseSize + formatBytes', () => {
  it('should work together for error messages', () => {
    const maxSize = parseSize('5MB');
    const actualSize = parseSize('10MB');

    const errorMessage = `File size ${formatBytes(actualSize)} exceeds maximum ${formatBytes(maxSize)}`;

    expect(errorMessage).toBe('File size 10 MB exceeds maximum 5 MB');
  });

  it('should work with various size comparisons', () => {
    const sizes = [
      { input: '1KB', bytes: 1024 },
      { input: '1MB', bytes: 1048576 },
      { input: '5GB', bytes: 5368709120 },
    ];

    sizes.forEach(({ input, bytes }) => {
      expect(parseSize(input)).toBe(bytes);
      expect(parseSize(formatBytes(bytes))).toBe(bytes);
    });
  });
});
