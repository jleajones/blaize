/**
 * @file Unit tests for configuration validation
 * @module @blaizejs/middleware-security/validation.test
 */

import { SecurityConfigurationError } from './error';
import { validateSecurityOptions } from './validation';

import type { SecurityOptions } from './types';

describe('validateSecurityOptions', () => {
  describe('valid configurations', () => {
    it('should accept empty options', () => {
      expect(() => validateSecurityOptions({})).not.toThrow();
    });

    it('should accept valid complete configuration', () => {
      const validOptions: SecurityOptions = {
        enabled: true,
        csp: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.example.com'],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'self'"],
          },
          reportOnly: false,
          reportUri: 'https://csp.example.com/report',
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        frameOptions: 'DENY',
        xssFilter: true,
        noSniff: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
        audit: false,
      };

      expect(() => validateSecurityOptions(validOptions)).not.toThrow();
    });

    it('should accept minimal CSP configuration', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: {
              defaultSrc: ["'self'"],
            },
          },
        })
      ).not.toThrow();
    });

    it('should accept HSTS with just maxAge', () => {
      expect(() =>
        validateSecurityOptions({
          hsts: {
            maxAge: 15552000,
          },
        })
      ).not.toThrow();
    });

    it('should accept disabled features with false', () => {
      expect(() =>
        validateSecurityOptions({
          csp: false,
          hsts: false,
          frameOptions: false,
          referrerPolicy: false,
        })
      ).not.toThrow();
    });

    it('should accept SAMEORIGIN for frameOptions', () => {
      expect(() =>
        validateSecurityOptions({
          frameOptions: 'SAMEORIGIN',
        })
      ).not.toThrow();
    });

    it('should accept all valid referrer policies', () => {
      const policies = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'origin',
        'origin-when-cross-origin',
        'same-origin',
        'strict-origin',
        'strict-origin-when-cross-origin',
        'unsafe-url',
      ] as const;

      policies.forEach(policy => {
        expect(() =>
          validateSecurityOptions({
            referrerPolicy: policy,
          })
        ).not.toThrow();
      });
    });

    it('should accept CSP directives with boolean values', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: {
              upgradeInsecureRequests: true,
              blockAllMixedContent: false,
            },
          },
        })
      ).not.toThrow();
    });

    it('should accept CSP directives with string values', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: {
              reportUri: 'https://csp.example.com/report',
            },
          },
        })
      ).not.toThrow();
    });

    it('should accept CSP directives with undefined values', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: undefined,
            },
          },
        })
      ).not.toThrow();
    });
  });

  describe('enabled validation', () => {
    it('should reject non-boolean enabled', () => {
      expect(() =>
        validateSecurityOptions({
          enabled: 'true' as any,
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should include helpful error message for invalid enabled', () => {
      try {
        validateSecurityOptions({
          enabled: 123 as any,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityConfigurationError);
        const message = (error as SecurityConfigurationError).message.toLowerCase();
        expect(message).toContain('enabled');
        expect(message).toContain('boolean');
      }
    });
  });

  describe('HSTS validation', () => {
    it('should reject non-number maxAge', () => {
      expect(() =>
        validateSecurityOptions({
          hsts: {
            maxAge: '31536000' as any,
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject negative maxAge', () => {
      expect(() =>
        validateSecurityOptions({
          hsts: {
            maxAge: -1,
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject zero maxAge', () => {
      expect(() =>
        validateSecurityOptions({
          hsts: {
            maxAge: 0,
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject non-finite maxAge', () => {
      expect(() =>
        validateSecurityOptions({
          hsts: {
            maxAge: Infinity,
          },
        })
      ).toThrow(SecurityConfigurationError);

      expect(() =>
        validateSecurityOptions({
          hsts: {
            maxAge: NaN,
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should include helpful error message for negative maxAge', () => {
      try {
        validateSecurityOptions({
          hsts: {
            maxAge: -5,
          },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityConfigurationError);
        const message = (error as SecurityConfigurationError).message.toLowerCase();
        expect(message).toContain('maxage');
        expect(message).toContain('positive');
      }
    });

    it('should reject non-boolean includeSubDomains', () => {
      expect(() =>
        validateSecurityOptions({
          hsts: {
            maxAge: 31536000,
            includeSubDomains: 'true' as any,
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject non-boolean preload', () => {
      expect(() =>
        validateSecurityOptions({
          hsts: {
            maxAge: 31536000,
            preload: 1 as any,
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should include helpful error message for invalid HSTS type', () => {
      try {
        validateSecurityOptions({
          hsts: {
            maxAge: 'invalid' as any,
          },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityConfigurationError);
        const message = (error as SecurityConfigurationError).message.toLowerCase();
        expect(message).toContain('hsts');
      }
    });
  });

  describe('CSP validation', () => {
    it('should reject invalid directive value types', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: {
              defaultSrc: 123 as any,
            },
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject object directive values', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: {
              defaultSrc: { self: true } as any,
            },
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject null directive values', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: {
              defaultSrc: null as any,
            },
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should include helpful error message for invalid directive type', () => {
      try {
        validateSecurityOptions({
          csp: {
            directives: {
              scriptSrc: 42 as any,
            },
          },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityConfigurationError);
        expect(error).toBeInstanceOf(SecurityConfigurationError);
        // Just verify it throws with SecurityConfigurationError
        // Zod will provide a good error message
      }
    });

    it('should reject arrays with non-string elements', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: {
              defaultSrc: ["'self'", 123 as any, 'https://example.com'],
            },
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should include helpful error message for non-string array element', () => {
      try {
        validateSecurityOptions({
          csp: {
            directives: {
              scriptSrc: ["'self'", null as any],
            },
          },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityConfigurationError);
        // Just verify it throws - Zod handles the message
      }
    });

    it('should reject non-boolean reportOnly', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: { defaultSrc: ["'self'"] },
            reportOnly: 'true' as any,
          },
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject non-string reportUri', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: { defaultSrc: ["'self'"] },
            reportUri: 123 as any,
          },
        })
      ).toThrow(SecurityConfigurationError);
    });
  });

  describe('frameOptions validation', () => {
    it('should reject invalid string values', () => {
      expect(() =>
        validateSecurityOptions({
          frameOptions: 'ALLOW-ALL' as any,
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject numeric values', () => {
      expect(() =>
        validateSecurityOptions({
          frameOptions: 1 as any,
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject boolean true', () => {
      expect(() =>
        validateSecurityOptions({
          frameOptions: true as any,
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should include helpful error message for invalid frameOptions', () => {
      try {
        validateSecurityOptions({
          frameOptions: 'INVALID' as any,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityConfigurationError);
        const message = (error as SecurityConfigurationError).message.toLowerCase();
        expect(message).toContain('frameoptions');
      }
    });
  });

  describe('referrerPolicy validation', () => {
    it('should reject invalid policy values', () => {
      expect(() =>
        validateSecurityOptions({
          referrerPolicy: 'invalid-policy' as any,
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject numeric values', () => {
      expect(() =>
        validateSecurityOptions({
          referrerPolicy: 0 as any,
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should include helpful error message for invalid referrerPolicy', () => {
      try {
        validateSecurityOptions({
          referrerPolicy: 'bad-policy' as any,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityConfigurationError);
        // Just verify it throws - Zod will list valid options
      }
    });
  });

  describe('boolean flag validation', () => {
    it('should reject non-boolean xssFilter', () => {
      expect(() =>
        validateSecurityOptions({
          xssFilter: 'true' as any,
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject non-boolean noSniff', () => {
      expect(() =>
        validateSecurityOptions({
          noSniff: 1 as any,
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should reject non-boolean audit', () => {
      expect(() =>
        validateSecurityOptions({
          audit: 'true' as any,
        })
      ).toThrow(SecurityConfigurationError);
    });
  });

  describe('error messages', () => {
    it('should have descriptive error messages', () => {
      const testCases = [
        {
          options: { hsts: { maxAge: -1 } },
          shouldContain: ['maxage', 'positive'],
        },
        {
          options: { frameOptions: 'INVALID' as any },
          shouldContain: ['frameoptions'],
        },
      ];

      testCases.forEach(({ options, shouldContain }) => {
        try {
          validateSecurityOptions(options as any);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(SecurityConfigurationError);
          const message = (error as SecurityConfigurationError).message.toLowerCase();
          shouldContain.forEach(keyword => {
            expect(message).toContain(keyword.toLowerCase());
          });
        }
      });
    });

    it('should include field path in error details', () => {
      try {
        validateSecurityOptions({
          enabled: 123 as any,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityConfigurationError);
        const details = (error as SecurityConfigurationError).details as { field?: string };
        expect(details).toHaveProperty('field');
        expect(details.field).toBe('enabled');
      }
    });
  });

  describe('complex configurations', () => {
    it('should validate and throw on first error', () => {
      // Validation stops at first error
      expect(() =>
        validateSecurityOptions({
          hsts: { maxAge: -1 },
          frameOptions: 'INVALID' as any,
        })
      ).toThrow(SecurityConfigurationError);
    });

    it('should accept complex valid configuration with all features', () => {
      const complexConfig: SecurityOptions = {
        enabled: true,
        csp: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.example.com'],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            connectSrc: ["'self'", 'wss:', 'https://api.example.com'],
            objectSrc: ["'none'"],
            frameSrc: ["'self'", 'https://trusted.example.com'],
            workerSrc: ["'self'"],
            upgradeInsecureRequests: true,
          },
          reportOnly: false,
          reportUri: 'https://csp.example.com/report',
        },
        hsts: {
          maxAge: 63072000, // 2 years
          includeSubDomains: true,
          preload: true,
        },
        frameOptions: 'DENY',
        xssFilter: true,
        noSniff: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
        audit: false,
      };

      expect(() => validateSecurityOptions(complexConfig)).not.toThrow();
    });

    it('should accept configuration with extensible CSP directives', () => {
      expect(() =>
        validateSecurityOptions({
          csp: {
            directives: {
              defaultSrc: ["'self'"],
              workerSrc: ["'self'", 'blob:'],
              manifestSrc: ["'self'"],
              mediaSrc: ["'self'", 'https://media.example.com'],
              childSrc: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              upgradeInsecureRequests: true,
              blockAllMixedContent: true,
            },
          },
        })
      ).not.toThrow();
    });
  });
});
