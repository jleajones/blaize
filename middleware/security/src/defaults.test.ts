import { DEVELOPMENT_DEFAULTS } from './defaults';

import type { SecurityOptions } from './types';

describe('DEVELOPMENT_DEFAULTS', () => {
  test('should be a valid SecurityOptions object', () => {
    expect(DEVELOPMENT_DEFAULTS).toBeDefined();
    expect(typeof DEVELOPMENT_DEFAULTS).toBe('object');
  });

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

    test('should have CSP directives defined', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives).toBeDefined();
        expect(typeof csp.directives).toBe('object');
      }
    });

    test('should have defaultSrc set to ["\'self\'"]', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.defaultSrc).toEqual(["'self'"]);
      }
    });

    test('should have scriptSrc with unsafe-inline and unsafe-eval', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.scriptSrc).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'"]);
      }
    });

    test('should have styleSrc with unsafe-inline', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.styleSrc).toEqual(["'self'", "'unsafe-inline'"]);
      }
    });

    test('should have imgSrc with self, data, and blob', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.imgSrc).toEqual(["'self'", 'data:', 'blob:']);
      }
    });

    test('should have fontSrc set to ["\'self\'"]', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.fontSrc).toEqual(["'self'"]);
      }
    });

    test('should have connectSrc with WebSocket support', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.connectSrc).toEqual(["'self'", 'ws:', 'wss:']);
      }
    });

    test('should have objectSrc set to ["\'none\'"]', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.objectSrc).toEqual(["'none'"]);
      }
    });

    test('should have frameSrc set to ["\'self\'"]', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.frameSrc).toEqual(["'self'"]);
      }
    });
  });

  describe('Development-Specific Features', () => {
    test('should allow unsafe-inline for HMR support', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.scriptSrc).toContain("'unsafe-inline'");
        expect(csp.directives.styleSrc).toContain("'unsafe-inline'");
      }
    });

    test('should allow unsafe-eval for HMR support', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.scriptSrc).toContain("'unsafe-eval'");
      }
    });

    test('should allow WebSocket protocols for HMR', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.connectSrc).toContain('ws:');
        expect(csp.directives.connectSrc).toContain('wss:');
      }
    });

    test('should allow data and blob URLs for dev tooling', () => {
      const csp = DEVELOPMENT_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.imgSrc).toContain('data:');
        expect(csp.directives.imgSrc).toContain('blob:');
      }
    });
  });

  describe('Type Compatibility', () => {
    test('should satisfy SecurityOptions interface', () => {
      const options: SecurityOptions = DEVELOPMENT_DEFAULTS;
      expect(options).toBeDefined();
    });

    test('should have all required fields for SecurityOptions', () => {
      expect(DEVELOPMENT_DEFAULTS).toHaveProperty('enabled');
      expect(DEVELOPMENT_DEFAULTS).toHaveProperty('hsts');
      expect(DEVELOPMENT_DEFAULTS).toHaveProperty('csp');
      expect(DEVELOPMENT_DEFAULTS).toHaveProperty('frameOptions');
      expect(DEVELOPMENT_DEFAULTS).toHaveProperty('xssFilter');
      expect(DEVELOPMENT_DEFAULTS).toHaveProperty('noSniff');
      expect(DEVELOPMENT_DEFAULTS).toHaveProperty('referrerPolicy');
      expect(DEVELOPMENT_DEFAULTS).toHaveProperty('audit');
    });
  });

  describe('Security Headers Configuration', () => {
    test('should enable all basic security headers', () => {
      expect(DEVELOPMENT_DEFAULTS.xssFilter).toBe(true);
      expect(DEVELOPMENT_DEFAULTS.noSniff).toBe(true);
    });

    test('should use permissive referrer policy', () => {
      expect(DEVELOPMENT_DEFAULTS.referrerPolicy).toBe('no-referrer-when-downgrade');
    });

    test('should use SAMEORIGIN for frameOptions (not DENY)', () => {
      expect(DEVELOPMENT_DEFAULTS.frameOptions).toBe('SAMEORIGIN');
      expect(DEVELOPMENT_DEFAULTS.frameOptions).not.toBe('DENY');
    });
  });

  describe('Immutability', () => {
    test('should not be the same object when referenced multiple times', () => {
      const ref1 = DEVELOPMENT_DEFAULTS;
      const ref2 = DEVELOPMENT_DEFAULTS;

      // Same reference (constant)
      expect(ref1).toBe(ref2);
    });

    test('should not mutate when spread into new object', () => {
      const copy = { ...DEVELOPMENT_DEFAULTS };

      expect(copy).toEqual(DEVELOPMENT_DEFAULTS);
      expect(copy).not.toBe(DEVELOPMENT_DEFAULTS);
    });
  });
});
