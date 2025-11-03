/**
 * Type-level tests for @blaizejs/middleware-security types
 *
 * These tests verify that the type system works correctly at compile time.
 * They use TypeScript's type checking to ensure types are properly defined.
 */

import type {
  CSPDirectives,
  CSPOptions,
  HSTSOptions,
  ReferrerPolicyOption,
  SecurityOptions,
  SecurityPreset,
} from './types';

describe('CSPDirectives', () => {
  it('should accept all 8 core directives as string arrays', () => {
    const directives: CSPDirectives = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.example.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://api.example.com'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    };

    expectTypeOf(directives).toMatchTypeOf<CSPDirectives>();
    expectTypeOf(directives.defaultSrc).toEqualTypeOf<string[] | undefined>();
    expectTypeOf(directives.scriptSrc).toEqualTypeOf<string[] | undefined>();
  });

  it('should accept extensible directives via index signature', () => {
    const directives: CSPDirectives = {
      defaultSrc: ["'self'"],
      // Additional directives (not in core 8)
      workerSrc: ["'self'"],
      mediaSrc: ["'self'", 'https://media.example.com'],
      upgradeInsecureRequests: true,
      reportUri: 'https://csp-reports.example.com',
      baseUri: ["'self'"],
    };

    expectTypeOf(directives).toMatchTypeOf<CSPDirectives>();
  });

  it('should accept boolean directives', () => {
    const directives: CSPDirectives = {
      upgradeInsecureRequests: true,
      blockAllMixedContent: false,
    };

    expectTypeOf(directives).toMatchTypeOf<CSPDirectives>();
  });

  it('should accept string directives', () => {
    const directives: CSPDirectives = {
      reportUri: 'https://csp-reports.example.com',
      sandbox: 'allow-forms allow-scripts',
    };

    expectTypeOf(directives).toMatchTypeOf<CSPDirectives>();
  });

  it('should allow undefined values', () => {
    const directives: CSPDirectives = {
      defaultSrc: undefined,
      scriptSrc: ["'self'"],
    };

    expectTypeOf(directives).toMatchTypeOf<CSPDirectives>();
  });

  it('should allow empty object', () => {
    const directives: CSPDirectives = {};

    expectTypeOf(directives).toMatchTypeOf<CSPDirectives>();
  });
});

describe('CSPOptions', () => {
  it('should require directives property', () => {
    const options: CSPOptions = {
      directives: {
        defaultSrc: ["'self'"],
      },
    };

    expectTypeOf(options).toMatchTypeOf<CSPOptions>();
    expectTypeOf(options.directives).not.toEqualTypeOf<undefined>();
  });

  it('should accept optional reportOnly', () => {
    const options: CSPOptions = {
      directives: { defaultSrc: ["'self'"] },
      reportOnly: true,
    };

    expectTypeOf(options).toMatchTypeOf<CSPOptions>();
    expectTypeOf(options.reportOnly).toEqualTypeOf<boolean | undefined>();
  });

  it('should accept optional reportUri', () => {
    const options: CSPOptions = {
      directives: { defaultSrc: ["'self'"] },
      reportUri: 'https://csp-reports.example.com',
    };

    expectTypeOf(options).toMatchTypeOf<CSPOptions>();
    expectTypeOf(options.reportUri).toEqualTypeOf<string | undefined>();
  });

  it('should accept all properties together', () => {
    const options: CSPOptions = {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.example.com'],
      },
      reportOnly: false,
      reportUri: 'https://csp-reports.example.com',
    };

    expectTypeOf(options).toMatchTypeOf<CSPOptions>();
  });
});

describe('HSTSOptions', () => {
  it('should require maxAge property', () => {
    const options: HSTSOptions = {
      maxAge: 31536000,
    };

    expectTypeOf(options).toMatchTypeOf<HSTSOptions>();
    expectTypeOf(options.maxAge).toEqualTypeOf<number>();
  });

  it('should accept optional includeSubDomains', () => {
    const options: HSTSOptions = {
      maxAge: 31536000,
      includeSubDomains: true,
    };

    expectTypeOf(options).toMatchTypeOf<HSTSOptions>();
    expectTypeOf(options.includeSubDomains).toEqualTypeOf<boolean | undefined>();
  });

  it('should accept optional preload', () => {
    const options: HSTSOptions = {
      maxAge: 63072000,
      preload: true,
    };

    expectTypeOf(options).toMatchTypeOf<HSTSOptions>();
    expectTypeOf(options.preload).toEqualTypeOf<boolean | undefined>();
  });

  it('should accept all properties together', () => {
    const options: HSTSOptions = {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    };

    expectTypeOf(options).toMatchTypeOf<HSTSOptions>();
  });
});

describe('ReferrerPolicyOption', () => {
  it('should accept all valid referrer policy values', () => {
    const policies: ReferrerPolicyOption[] = [
      'no-referrer',
      'no-referrer-when-downgrade',
      'origin',
      'origin-when-cross-origin',
      'same-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
      'unsafe-url',
    ];

    policies.forEach(policy => {
      expectTypeOf(policy).toEqualTypeOf<ReferrerPolicyOption>();
    });
  });

  it('should be a string literal union', () => {
    expectTypeOf<ReferrerPolicyOption>().toBeString();
  });
});

describe('SecurityOptions', () => {
  it('should allow empty object (all properties optional)', () => {
    const options: SecurityOptions = {};

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
  });

  it('should accept enabled property', () => {
    const options: SecurityOptions = {
      enabled: false,
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(options.enabled).toEqualTypeOf<boolean | undefined>();
  });

  it('should accept CSPOptions for csp property', () => {
    const options: SecurityOptions = {
      csp: {
        directives: {
          defaultSrc: ["'self'"],
        },
      },
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(options.csp).toEqualTypeOf<CSPOptions | false | undefined>();
  });

  it('should accept false for csp property', () => {
    const options: SecurityOptions = {
      csp: false,
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
  });

  it('should accept HSTSOptions for hsts property', () => {
    const options: SecurityOptions = {
      hsts: {
        maxAge: 31536000,
      },
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(options.hsts).toEqualTypeOf<HSTSOptions | false | undefined>();
  });

  it('should accept false for hsts property', () => {
    const options: SecurityOptions = {
      hsts: false,
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
  });

  it('should accept frameOptions values', () => {
    const deny: SecurityOptions = { frameOptions: 'DENY' };
    const sameorigin: SecurityOptions = { frameOptions: 'SAMEORIGIN' };
    const disabled: SecurityOptions = { frameOptions: false };

    expectTypeOf(deny).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(sameorigin).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(disabled).toMatchTypeOf<SecurityOptions>();
    expectTypeOf<SecurityOptions['frameOptions']>().toEqualTypeOf<
      'DENY' | 'SAMEORIGIN' | false | undefined
    >();
  });

  it('should accept xssFilter as boolean', () => {
    const options: SecurityOptions = {
      xssFilter: true,
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(options.xssFilter).toEqualTypeOf<boolean | undefined>();
  });

  it('should accept noSniff as boolean', () => {
    const options: SecurityOptions = {
      noSniff: true,
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(options.noSniff).toEqualTypeOf<boolean | undefined>();
  });

  it('should accept ReferrerPolicyOption for referrerPolicy', () => {
    const options: SecurityOptions = {
      referrerPolicy: 'strict-origin-when-cross-origin',
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(options.referrerPolicy).toEqualTypeOf<ReferrerPolicyOption | false | undefined>();
  });

  it('should accept false for referrerPolicy', () => {
    const options: SecurityOptions = {
      referrerPolicy: false,
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
  });

  it('should accept hidePoweredBy as boolean', () => {
    const options: SecurityOptions = {
      hidePoweredBy: true,
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(options.hidePoweredBy).toEqualTypeOf<boolean | undefined>();
  });

  it('should accept audit as boolean', () => {
    const options: SecurityOptions = {
      audit: true,
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
    expectTypeOf(options.audit).toEqualTypeOf<boolean | undefined>();
  });

  it('should accept all properties together', () => {
    const options: SecurityOptions = {
      enabled: true,
      csp: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.example.com'],
        },
        reportOnly: false,
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false,
      },
      frameOptions: 'DENY',
      xssFilter: true,
      noSniff: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      hidePoweredBy: true,
      audit: false,
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
  });

  it('should allow partial configuration', () => {
    const options: SecurityOptions = {
      csp: {
        directives: {
          scriptSrc: ["'self'"],
        },
      },
      frameOptions: 'SAMEORIGIN',
    };

    expectTypeOf(options).toMatchTypeOf<SecurityOptions>();
  });

  it('should not contain any types', () => {
    type HasAny<T> = 0 extends 1 & T ? true : false;

    expectTypeOf<HasAny<SecurityOptions>>().toEqualTypeOf<false>();
    expectTypeOf<HasAny<CSPOptions>>().toEqualTypeOf<false>();
    expectTypeOf<HasAny<HSTSOptions>>().toEqualTypeOf<false>();
    expectTypeOf<HasAny<CSPDirectives>>().toEqualTypeOf<false>();
  });
});

describe('SecurityPreset', () => {
  it('should accept all preset values', () => {
    const presets: SecurityPreset[] = ['development', 'production', 'api', 'spa'];

    presets.forEach(preset => {
      expectTypeOf(preset).toEqualTypeOf<SecurityPreset>();
    });
  });

  it('should be a string literal union', () => {
    expectTypeOf<SecurityPreset>().toBeString();
  });

  it('should only allow specific preset names', () => {
    expectTypeOf<SecurityPreset>().toEqualTypeOf<'development' | 'production' | 'api' | 'spa'>();
  });
});

describe('Type exports', () => {
  it('should export all types', () => {
    expectTypeOf<CSPDirectives>().not.toBeAny();
    expectTypeOf<CSPOptions>().not.toBeAny();
    expectTypeOf<HSTSOptions>().not.toBeAny();
    expectTypeOf<ReferrerPolicyOption>().not.toBeAny();
    expectTypeOf<SecurityOptions>().not.toBeAny();
    expectTypeOf<SecurityPreset>().not.toBeAny();
  });
});
