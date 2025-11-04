import {
  DEVELOPMENT_DEFAULTS,
  PRODUCTION_DEFAULTS,
  getDefaultSecurityOptions,
  mergeSecurityOptions,
} from './defaults';

import type { SecurityOptions } from './types';

describe('defaults.ts', () => {
  // Clean up environment after each test
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('DEVELOPMENT_DEFAULTS [T2.2]', () => {
    describe('Top-Level Options', () => {
      test('should have enabled set to true', () => {
        expect(DEVELOPMENT_DEFAULTS.enabled).toBe(true);
      });

      test('should have HSTS disabled', () => {
        expect(DEVELOPMENT_DEFAULTS.hsts).toBe(false);
      });

      test('should have frameOptions set to SAMEORIGIN', () => {
        expect(DEVELOPMENT_DEFAULTS.frameOptions).toBe('SAMEORIGIN');
      });

      test('should have xssFilter enabled', () => {
        expect(DEVELOPMENT_DEFAULTS.xssFilter).toBe(true);
      });

      test('should have noSniff enabled', () => {
        expect(DEVELOPMENT_DEFAULTS.noSniff).toBe(true);
      });

      test('should have referrerPolicy set to no-referrer-when-downgrade', () => {
        expect(DEVELOPMENT_DEFAULTS.referrerPolicy).toBe('no-referrer-when-downgrade');
      });

      test('should have audit disabled', () => {
        expect(DEVELOPMENT_DEFAULTS.audit).toBe(false);
      });
    });

    describe('CSP Configuration', () => {
      test('should have CSP object defined', () => {
        expect(DEVELOPMENT_DEFAULTS.csp).toBeDefined();
        expect(typeof DEVELOPMENT_DEFAULTS.csp).toBe('object');
        expect(DEVELOPMENT_DEFAULTS.csp).not.toBe(false);
      });

      test('should have all 8 core directives defined', () => {
        const csp = DEVELOPMENT_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.defaultSrc).toBeDefined();
          expect(csp.directives.scriptSrc).toBeDefined();
          expect(csp.directives.styleSrc).toBeDefined();
          expect(csp.directives.imgSrc).toBeDefined();
          expect(csp.directives.fontSrc).toBeDefined();
          expect(csp.directives.connectSrc).toBeDefined();
          expect(csp.directives.objectSrc).toBeDefined();
          expect(csp.directives.frameSrc).toBeDefined();
        }
      });

      test('should allow unsafe-inline and unsafe-eval for scriptSrc', () => {
        const csp = DEVELOPMENT_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.scriptSrc).toContain("'unsafe-inline'");
          expect(csp.directives.scriptSrc).toContain("'unsafe-eval'");
        }
      });

      test('should allow unsafe-inline for styleSrc', () => {
        const csp = DEVELOPMENT_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.styleSrc).toContain("'unsafe-inline'");
        }
      });

      test('should allow WebSocket protocols in connectSrc', () => {
        const csp = DEVELOPMENT_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.connectSrc).toContain('ws:');
          expect(csp.directives.connectSrc).toContain('wss:');
        }
      });

      test('should allow data and blob URLs in imgSrc', () => {
        const csp = DEVELOPMENT_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.imgSrc).toContain('data:');
          expect(csp.directives.imgSrc).toContain('blob:');
        }
      });
    });
  });

  describe('PRODUCTION_DEFAULTS [T2.3]', () => {
    describe('Top-Level Options', () => {
      test('should have enabled set to true', () => {
        expect(PRODUCTION_DEFAULTS.enabled).toBe(true);
      });

      test('should have HSTS enabled with correct settings', () => {
        expect(PRODUCTION_DEFAULTS.hsts).toBeDefined();
        expect(PRODUCTION_DEFAULTS.hsts).not.toBe(false);

        if (PRODUCTION_DEFAULTS.hsts) {
          expect(PRODUCTION_DEFAULTS.hsts.maxAge).toBe(31536000); // 1 year
          expect(PRODUCTION_DEFAULTS.hsts.includeSubDomains).toBe(true);
          expect(PRODUCTION_DEFAULTS.hsts.preload).toBe(false);
        }
      });

      test('should have frameOptions set to DENY', () => {
        expect(PRODUCTION_DEFAULTS.frameOptions).toBe('DENY');
      });

      test('should have all security headers enabled', () => {
        expect(PRODUCTION_DEFAULTS.xssFilter).toBe(true);
        expect(PRODUCTION_DEFAULTS.noSniff).toBe(true);
      });

      test('should have strict referrer policy', () => {
        expect(PRODUCTION_DEFAULTS.referrerPolicy).toBe('strict-origin-when-cross-origin');
      });

      test('should have audit disabled by default', () => {
        expect(PRODUCTION_DEFAULTS.audit).toBe(false);
      });
    });

    describe('CSP Configuration', () => {
      test('should have strict CSP with no unsafe directives', () => {
        const csp = PRODUCTION_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.scriptSrc).not.toContain("'unsafe-inline'");
          expect(csp.directives.scriptSrc).not.toContain("'unsafe-eval'");
          expect(csp.directives.styleSrc).not.toContain("'unsafe-inline'");
        }
      });

      test('should have scriptSrc limited to self only', () => {
        const csp = PRODUCTION_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.scriptSrc).toEqual(["'self'"]);
        }
      });

      test('should have styleSrc limited to self only', () => {
        const csp = PRODUCTION_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.styleSrc).toEqual(["'self'"]);
        }
      });

      test('should allow https images in imgSrc', () => {
        const csp = PRODUCTION_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.imgSrc).toContain("'self'");
          expect(csp.directives.imgSrc).toContain('data:');
          expect(csp.directives.imgSrc).toContain('https:');
        }
      });

      test('should have no WebSocket protocols in connectSrc', () => {
        const csp = PRODUCTION_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.connectSrc).not.toContain('ws:');
          expect(csp.directives.connectSrc).not.toContain('wss:');
        }
      });

      test('should block all iframes', () => {
        const csp = PRODUCTION_DEFAULTS.csp;
        if (csp) {
          expect(csp.directives.frameSrc).toEqual(["'none'"]);
        }
      });
    });
  });

  describe('getDefaultSecurityOptions [T2.4]', () => {
    test('should return DEVELOPMENT_DEFAULTS when NODE_ENV is not production', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const result = getDefaultSecurityOptions();
      expect(result).toEqual(DEVELOPMENT_DEFAULTS);
    });

    test('should return PRODUCTION_DEFAULTS when NODE_ENV is production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const result = getDefaultSecurityOptions();
      expect(result).toEqual(PRODUCTION_DEFAULTS);
    });

    test('should return DEVELOPMENT_DEFAULTS when NODE_ENV is not set', () => {
      vi.stubEnv('NODE_ENV', '');
      const result = getDefaultSecurityOptions();
      expect(result).toEqual(DEVELOPMENT_DEFAULTS);
    });

    test('should return DEVELOPMENT_DEFAULTS for test environment', () => {
      vi.stubEnv('NODE_ENV', 'test');
      const result = getDefaultSecurityOptions();
      expect(result).toEqual(DEVELOPMENT_DEFAULTS);
    });

    test('should return DEVELOPMENT_DEFAULTS for staging environment', () => {
      vi.stubEnv('NODE_ENV', 'staging');
      const result = getDefaultSecurityOptions();
      expect(result).toEqual(DEVELOPMENT_DEFAULTS);
    });
  });

  describe('mergeSecurityOptions [T2.4]', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    describe('No User Options', () => {
      test('should return environment defaults when undefined', () => {
        const result = mergeSecurityOptions(undefined);
        expect(result).toEqual(DEVELOPMENT_DEFAULTS);
      });

      test('should return environment defaults when called without arguments', () => {
        const result = mergeSecurityOptions();
        expect(result).toEqual(DEVELOPMENT_DEFAULTS);
      });
    });

    describe('Shallow Merge (Top-Level Options)', () => {
      test('should override enabled flag', () => {
        const result = mergeSecurityOptions({ enabled: false });
        expect(result.enabled).toBe(false);
        expect(result.csp).toEqual(DEVELOPMENT_DEFAULTS.csp);
      });

      test('should override frameOptions', () => {
        const result = mergeSecurityOptions({ frameOptions: 'DENY' });
        expect(result.frameOptions).toBe('DENY');
        expect(result.csp).toEqual(DEVELOPMENT_DEFAULTS.csp);
      });

      test('should override xssFilter', () => {
        const result = mergeSecurityOptions({ xssFilter: false });
        expect(result.xssFilter).toBe(false);
        expect(result.csp).toEqual(DEVELOPMENT_DEFAULTS.csp);
      });

      test('should override referrerPolicy', () => {
        const result = mergeSecurityOptions({ referrerPolicy: 'no-referrer' });
        expect(result.referrerPolicy).toBe('no-referrer');
      });

      test('should override audit mode', () => {
        const result = mergeSecurityOptions({ audit: true });
        expect(result.audit).toBe(true);
      });

      test('should override multiple top-level options', () => {
        const result = mergeSecurityOptions({
          enabled: false,
          frameOptions: 'DENY',
          audit: true,
        });
        expect(result.enabled).toBe(false);
        expect(result.frameOptions).toBe('DENY');
        expect(result.audit).toBe(true);
      });
    });

    describe('Deep Merge (CSP Directives)', () => {
      test('should merge single CSP directive with defaults', () => {
        const result = mergeSecurityOptions({
          csp: {
            directives: {
              scriptSrc: ["'self'", 'https://cdn.example.com'],
            },
          },
        });

        if (result.csp) {
          expect(result.csp.directives.scriptSrc).toEqual(["'self'", 'https://cdn.example.com']);
          // Other directives should remain from defaults
          expect(result.csp.directives.styleSrc).toEqual(
            DEVELOPMENT_DEFAULTS.csp ? DEVELOPMENT_DEFAULTS.csp.directives.styleSrc : undefined
          );
        }
      });

      test('should merge multiple CSP directives with defaults', () => {
        const result = mergeSecurityOptions({
          csp: {
            directives: {
              scriptSrc: ["'self'", 'https://scripts.example.com'],
              styleSrc: ["'self'", 'https://styles.example.com'],
            },
          },
        });

        if (result.csp) {
          expect(result.csp.directives.scriptSrc).toEqual([
            "'self'",
            'https://scripts.example.com',
          ]);
          expect(result.csp.directives.styleSrc).toEqual(["'self'", 'https://styles.example.com']);
          // Other directives should remain from defaults
          expect(result.csp.directives.imgSrc).toEqual(
            DEVELOPMENT_DEFAULTS.csp ? DEVELOPMENT_DEFAULTS.csp.directives.imgSrc : undefined
          );
        }
      });

      test('should respect CSP reportOnly and reportUri options', () => {
        const result = mergeSecurityOptions({
          csp: {
            reportOnly: true,
            reportUri: 'https://csp-report.example.com',
            directives: {
              scriptSrc: ["'self'"],
            },
          },
        });

        if (result.csp) {
          expect(result.csp.reportOnly).toBe(true);
          expect(result.csp.reportUri).toBe('https://csp-report.example.com');
        }
      });

      test('should preserve default reportOnly when not provided', () => {
        const result = mergeSecurityOptions({
          csp: {
            directives: {
              scriptSrc: ["'self'"],
            },
          },
        });

        if (result.csp) {
          expect(result.csp.reportOnly).toBeUndefined();
        }
      });
    });

    describe('False Values (Disabling Features)', () => {
      test('should handle csp: false correctly', () => {
        const result = mergeSecurityOptions({ csp: false });
        expect(result.csp).toBe(false);
        // Other options should remain from defaults
        expect(result.frameOptions).toEqual(DEVELOPMENT_DEFAULTS.frameOptions);
      });

      test('should handle hsts: false correctly', () => {
        const result = mergeSecurityOptions({ hsts: false });
        expect(result.hsts).toBe(false);
        // Other options should remain from defaults
        expect(result.csp).toEqual(DEVELOPMENT_DEFAULTS.csp);
      });

      test('should handle referrerPolicy: false correctly', () => {
        const result = mergeSecurityOptions({ referrerPolicy: false });
        expect(result.referrerPolicy).toBe(false);
      });

      test('should handle frameOptions: false correctly', () => {
        const result = mergeSecurityOptions({ frameOptions: false });
        expect(result.frameOptions).toBe(false);
      });

      test('should handle multiple false values', () => {
        const result = mergeSecurityOptions({
          csp: false,
          hsts: false,
          frameOptions: false,
        });
        expect(result.csp).toBe(false);
        expect(result.hsts).toBe(false);
        expect(result.frameOptions).toBe(false);
      });
    });

    describe('Partial CSPOptions', () => {
      test('should handle partial CSP with only directives', () => {
        const result = mergeSecurityOptions({
          csp: {
            directives: {
              scriptSrc: ["'self'", 'https://example.com'],
            },
          },
        });

        if (result.csp) {
          expect(result.csp.directives.scriptSrc).toBeDefined();
          expect(result.csp.reportOnly).toBeUndefined();
          expect(result.csp.reportUri).toBeUndefined();
        }
      });

      test('should handle partial CSP with only reportOnly', () => {
        const result = mergeSecurityOptions({
          csp: {
            reportOnly: true,
            directives: {},
          },
        });

        if (result.csp) {
          expect(result.csp.reportOnly).toBe(true);
          // Should still have default directives
          expect(result.csp.directives.defaultSrc).toEqual(
            DEVELOPMENT_DEFAULTS.csp ? DEVELOPMENT_DEFAULTS.csp.directives.defaultSrc : undefined
          );
        }
      });
    });

    describe('Edge Cases', () => {
      test('should handle empty object', () => {
        const result = mergeSecurityOptions({});
        expect(result).toEqual(DEVELOPMENT_DEFAULTS);
      });

      test('should handle object with only undefined values', () => {
        const result = mergeSecurityOptions({
          enabled: undefined,
          csp: undefined,
        });
        expect(result).toEqual(DEVELOPMENT_DEFAULTS);
      });

      test('should override directive completely, not merge arrays', () => {
        const result = mergeSecurityOptions({
          csp: {
            directives: {
              scriptSrc: ['https://example.com'], // No 'self'
            },
          },
        });

        if (result.csp) {
          expect(result.csp.directives.scriptSrc).toEqual(['https://example.com']);
          expect(result.csp.directives.scriptSrc).not.toContain("'self'");
        }
      });
    });

    describe('Production Environment', () => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'production');
      });

      test('should use PRODUCTION_DEFAULTS as base', () => {
        const result = mergeSecurityOptions({
          audit: true,
        });

        expect(result.audit).toBe(true);
        expect(result.frameOptions).toBe('DENY'); // From PRODUCTION_DEFAULTS
        expect(result.hsts).toEqual(PRODUCTION_DEFAULTS.hsts);
      });

      test('should deep merge CSP directives in production', () => {
        const result = mergeSecurityOptions({
          csp: {
            directives: {
              scriptSrc: ["'self'", 'https://cdn.example.com'],
            },
          },
        });

        if (result.csp) {
          expect(result.csp.directives.scriptSrc).toEqual(["'self'", 'https://cdn.example.com']);
          // Should keep production defaults for other directives
          expect(result.csp.directives.frameSrc).toEqual(["'none'"]);
        }
      });
    });

    describe('Type Compatibility', () => {
      test('should satisfy SecurityOptions interface', () => {
        const result: SecurityOptions = mergeSecurityOptions({});
        expect(result).toBeDefined();
      });

      test('should accept Partial<SecurityOptions>', () => {
        const partial: Partial<SecurityOptions> = {
          enabled: false,
        };
        const result = mergeSecurityOptions(partial);
        expect(result.enabled).toBe(false);
      });
    });
  });
});
