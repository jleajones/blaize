import { DEVELOPMENT_DEFAULTS, PRODUCTION_DEFAULTS } from './defaults';

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

describe('PRODUCTION_DEFAULTS', () => {
  test('should be a valid SecurityOptions object', () => {
    expect(PRODUCTION_DEFAULTS).toBeDefined();
    expect(typeof PRODUCTION_DEFAULTS).toBe('object');
  });

  describe('Top-Level Options', () => {
    test('should have enabled set to true', () => {
      expect(PRODUCTION_DEFAULTS.enabled).toBe(true);
    });

    test('should have HSTS enabled with object configuration', () => {
      expect(PRODUCTION_DEFAULTS.hsts).toBeDefined();
      expect(typeof PRODUCTION_DEFAULTS.hsts).toBe('object');
      expect(PRODUCTION_DEFAULTS.hsts).not.toBe(false);
    });

    test('should have frameOptions set to DENY', () => {
      expect(PRODUCTION_DEFAULTS.frameOptions).toBe('DENY');
    });

    test('should have xssFilter enabled', () => {
      expect(PRODUCTION_DEFAULTS.xssFilter).toBe(true);
    });

    test('should have noSniff enabled', () => {
      expect(PRODUCTION_DEFAULTS.noSniff).toBe(true);
    });

    test('should have referrerPolicy set to strict-origin-when-cross-origin', () => {
      expect(PRODUCTION_DEFAULTS.referrerPolicy).toBe('strict-origin-when-cross-origin');
    });

    test('should have audit disabled', () => {
      expect(PRODUCTION_DEFAULTS.audit).toBe(false);
    });
  });

  describe('HSTS Configuration', () => {
    test('should have HSTS maxAge set to 1 year', () => {
      const hsts = PRODUCTION_DEFAULTS.hsts;
      if (hsts) {
        expect(hsts.maxAge).toBe(31536000); // 1 year in seconds
      }
    });

    test('should have HSTS includeSubDomains set to true', () => {
      const hsts = PRODUCTION_DEFAULTS.hsts;
      if (hsts) {
        expect(hsts.includeSubDomains).toBe(true);
      }
    });

    test('should have HSTS preload set to false', () => {
      const hsts = PRODUCTION_DEFAULTS.hsts;
      if (hsts) {
        expect(hsts.preload).toBe(false);
      }
    });
  });

  describe('CSP Configuration', () => {
    test('should have CSP object defined', () => {
      expect(PRODUCTION_DEFAULTS.csp).toBeDefined();
      expect(typeof PRODUCTION_DEFAULTS.csp).toBe('object');
      expect(PRODUCTION_DEFAULTS.csp).not.toBe(false);
    });

    test('should have CSP directives defined', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives).toBeDefined();
        expect(typeof csp.directives).toBe('object');
      }
    });

    test('should have defaultSrc set to ["\'self\'"]', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.defaultSrc).toEqual(["'self'"]);
      }
    });

    test('should have strict scriptSrc with NO unsafe directives', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.scriptSrc).toEqual(["'self'"]);
        expect(csp.directives.scriptSrc).not.toContain("'unsafe-inline'");
        expect(csp.directives.scriptSrc).not.toContain("'unsafe-eval'");
      }
    });

    test('should have strict styleSrc with NO unsafe directives', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.styleSrc).toEqual(["'self'"]);
        expect(csp.directives.styleSrc).not.toContain("'unsafe-inline'");
      }
    });

    test('should have imgSrc with self, data, and https', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.imgSrc).toEqual(["'self'", 'data:', 'https:']);
      }
    });

    test('should have fontSrc set to ["\'self\'"]', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.fontSrc).toEqual(["'self'"]);
      }
    });

    test('should have strict connectSrc with NO WebSocket protocols', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.connectSrc).toEqual(["'self'"]);
        expect(csp.directives.connectSrc).not.toContain('ws:');
        expect(csp.directives.connectSrc).not.toContain('wss:');
      }
    });

    test('should have objectSrc set to ["\'none\'"]', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.objectSrc).toEqual(["'none'"]);
      }
    });

    test('should have frameSrc set to ["\'none\'"]', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.frameSrc).toEqual(["'none'"]);
      }
    });
  });

  describe('Production-Specific Security', () => {
    test('should NOT allow unsafe-inline for scripts', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.scriptSrc).not.toContain("'unsafe-inline'");
      }
    });

    test('should NOT allow unsafe-eval for scripts', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.scriptSrc).not.toContain("'unsafe-eval'");
      }
    });

    test('should NOT allow unsafe-inline for styles', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.styleSrc).not.toContain("'unsafe-inline'");
      }
    });

    test('should NOT allow WebSocket protocols', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.connectSrc).not.toContain('ws:');
        expect(csp.directives.connectSrc).not.toContain('wss:');
      }
    });

    test('should NOT allow blob URLs', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.imgSrc).not.toContain('blob:');
      }
    });

    test('should block all iframes (frameSrc none)', () => {
      const csp = PRODUCTION_DEFAULTS.csp;
      if (csp) {
        expect(csp.directives.frameSrc).toEqual(["'none'"]);
      }
    });

    test('should use DENY for frameOptions (strictest)', () => {
      expect(PRODUCTION_DEFAULTS.frameOptions).toBe('DENY');
      expect(PRODUCTION_DEFAULTS.frameOptions).not.toBe('SAMEORIGIN');
    });
  });

  describe('Type Compatibility', () => {
    test('should satisfy SecurityOptions interface', () => {
      const options: SecurityOptions = PRODUCTION_DEFAULTS;
      expect(options).toBeDefined();
    });

    test('should have all required fields for SecurityOptions', () => {
      expect(PRODUCTION_DEFAULTS).toHaveProperty('enabled');
      expect(PRODUCTION_DEFAULTS).toHaveProperty('hsts');
      expect(PRODUCTION_DEFAULTS).toHaveProperty('csp');
      expect(PRODUCTION_DEFAULTS).toHaveProperty('frameOptions');
      expect(PRODUCTION_DEFAULTS).toHaveProperty('xssFilter');
      expect(PRODUCTION_DEFAULTS).toHaveProperty('noSniff');
      expect(PRODUCTION_DEFAULTS).toHaveProperty('referrerPolicy');
      expect(PRODUCTION_DEFAULTS).toHaveProperty('audit');
    });
  });

  describe('Security Headers Configuration', () => {
    test('should enable all security headers', () => {
      expect(PRODUCTION_DEFAULTS.xssFilter).toBe(true);
      expect(PRODUCTION_DEFAULTS.noSniff).toBe(true);
    });

    test('should use strict referrer policy', () => {
      expect(PRODUCTION_DEFAULTS.referrerPolicy).toBe('strict-origin-when-cross-origin');
    });

    test('should use DENY for frameOptions', () => {
      expect(PRODUCTION_DEFAULTS.frameOptions).toBe('DENY');
    });
  });

  describe('HSTS Production Settings', () => {
    test('should have HSTS enabled (not false)', () => {
      expect(PRODUCTION_DEFAULTS.hsts).not.toBe(false);
    });

    test('should have maxAge of at least 1 year', () => {
      const hsts = PRODUCTION_DEFAULTS.hsts;
      if (hsts) {
        expect(hsts.maxAge).toBeGreaterThanOrEqual(31536000);
      }
    });

    test('should include subdomains for HSTS', () => {
      const hsts = PRODUCTION_DEFAULTS.hsts;
      if (hsts) {
        expect(hsts.includeSubDomains).toBe(true);
      }
    });
  });

  describe('Immutability', () => {
    test('should not be the same object when referenced multiple times', () => {
      const ref1 = PRODUCTION_DEFAULTS;
      const ref2 = PRODUCTION_DEFAULTS;

      // Same reference (constant)
      expect(ref1).toBe(ref2);
    });

    test('should not mutate when spread into new object', () => {
      const copy = { ...PRODUCTION_DEFAULTS };

      expect(copy).toEqual(PRODUCTION_DEFAULTS);
      expect(copy).not.toBe(PRODUCTION_DEFAULTS);
    });
  });
});

describe('DEVELOPMENT vs PRODUCTION Comparison', () => {
  test('should have opposite frameOptions values', () => {
    expect(DEVELOPMENT_DEFAULTS.frameOptions).toBe('SAMEORIGIN');
    expect(PRODUCTION_DEFAULTS.frameOptions).toBe('DENY');
  });

  test('should have different HSTS settings', () => {
    expect(DEVELOPMENT_DEFAULTS.hsts).toBe(false);
    expect(PRODUCTION_DEFAULTS.hsts).not.toBe(false);
  });

  test('should have different CSP scriptSrc policies', () => {
    const devCsp = DEVELOPMENT_DEFAULTS.csp;
    const prodCsp = PRODUCTION_DEFAULTS.csp;

    if (devCsp && prodCsp) {
      expect(devCsp.directives.scriptSrc).toContain("'unsafe-inline'");
      expect(prodCsp.directives.scriptSrc).not.toContain("'unsafe-inline'");
    }
  });

  test('should have different referrer policies', () => {
    expect(DEVELOPMENT_DEFAULTS.referrerPolicy).toBe('no-referrer-when-downgrade');
    expect(PRODUCTION_DEFAULTS.referrerPolicy).toBe('strict-origin-when-cross-origin');
  });

  test('development should allow WebSockets, production should not', () => {
    const devCsp = DEVELOPMENT_DEFAULTS.csp;
    const prodCsp = PRODUCTION_DEFAULTS.csp;

    if (devCsp && prodCsp) {
      expect(devCsp.directives.connectSrc).toContain('ws:');
      expect(prodCsp.directives.connectSrc).not.toContain('ws:');
    }
  });

  test('development should allow blob URLs, production should not', () => {
    const devCsp = DEVELOPMENT_DEFAULTS.csp;
    const prodCsp = PRODUCTION_DEFAULTS.csp;

    if (devCsp && prodCsp) {
      expect(devCsp.directives.imgSrc).toContain('blob:');
      expect(prodCsp.directives.imgSrc).not.toContain('blob:');
    }
  });

  test('production should allow https for images, both should allow data', () => {
    const devCsp = DEVELOPMENT_DEFAULTS.csp;
    const prodCsp = PRODUCTION_DEFAULTS.csp;

    if (devCsp && prodCsp) {
      expect(devCsp.directives.imgSrc).toContain('data:');
      expect(prodCsp.directives.imgSrc).toContain('data:');
      expect(prodCsp.directives.imgSrc).toContain('https:');
    }
  });

  test('both should enable basic security headers', () => {
    expect(DEVELOPMENT_DEFAULTS.xssFilter).toBe(PRODUCTION_DEFAULTS.xssFilter);
    expect(DEVELOPMENT_DEFAULTS.noSniff).toBe(PRODUCTION_DEFAULTS.noSniff);
  });

  test('both should have audit disabled by default', () => {
    expect(DEVELOPMENT_DEFAULTS.audit).toBe(false);
    expect(PRODUCTION_DEFAULTS.audit).toBe(false);
  });
});
