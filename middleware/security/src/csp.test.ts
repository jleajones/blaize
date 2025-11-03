/**
 * Unit tests for CSP header builder
 */

import { buildCSPHeader } from './csp.js';

describe('buildCSPHeader', () => {
  describe('Core directives (8 essential)', () => {
    it('should handle defaultSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
        },
      });

      expect(result).toBe("default-src 'self'");
    });

    it('should handle scriptSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'self'", 'https://cdn.example.com'],
        },
      });

      expect(result).toBe("script-src 'self' https://cdn.example.com");
    });

    it('should handle styleSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      });

      expect(result).toBe("style-src 'self' 'unsafe-inline'");
    });

    it('should handle imgSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      });

      expect(result).toBe("img-src 'self' data: https:");
    });

    it('should handle fontSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        },
      });

      expect(result).toBe("font-src 'self' https://fonts.gstatic.com");
    });

    it('should handle connectSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          connectSrc: ["'self'", 'https://api.example.com', 'wss://ws.example.com'],
        },
      });

      expect(result).toBe("connect-src 'self' https://api.example.com wss://ws.example.com");
    });

    it('should handle objectSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          objectSrc: ["'none'"],
        },
      });

      expect(result).toBe("object-src 'none'");
    });

    it('should handle frameSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          frameSrc: ["'self'", 'https://www.youtube.com'],
        },
      });

      expect(result).toBe("frame-src 'self' https://www.youtube.com");
    });

    it('should handle all 8 core directives together', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      });

      expect(result).toBe(
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'"
      );
    });
  });

  describe('Extensible directives (via index signature)', () => {
    it('should handle workerSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          workerSrc: ["'self'"],
        },
      });

      expect(result).toBe("worker-src 'self'");
    });

    it('should handle mediaSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          mediaSrc: ["'self'", 'https://media.example.com'],
        },
      });

      expect(result).toBe("media-src 'self' https://media.example.com");
    });

    it('should handle frameAncestors directive', () => {
      const result = buildCSPHeader({
        directives: {
          frameAncestors: ["'none'"],
        },
      });

      expect(result).toBe("frame-ancestors 'none'");
    });

    it('should handle formAction directive', () => {
      const result = buildCSPHeader({
        directives: {
          formAction: ["'self'"],
        },
      });

      expect(result).toBe("form-action 'self'");
    });

    it('should handle baseUri directive', () => {
      const result = buildCSPHeader({
        directives: {
          baseUri: ["'self'"],
        },
      });

      expect(result).toBe("base-uri 'self'");
    });

    it('should handle manifestSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          manifestSrc: ["'self'"],
        },
      });

      expect(result).toBe("manifest-src 'self'");
    });

    it('should handle childSrc directive', () => {
      const result = buildCSPHeader({
        directives: {
          childSrc: ["'self'"],
        },
      });

      expect(result).toBe("child-src 'self'");
    });

    it('should handle multiple extensible directives', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          workerSrc: ["'self'"],
          mediaSrc: ["'self'", 'https://media.example.com'],
          frameAncestors: ["'none'"],
        },
      });

      expect(result).toBe(
        "default-src 'self'; worker-src 'self'; media-src 'self' https://media.example.com; frame-ancestors 'none'"
      );
    });
  });

  describe('Boolean directives', () => {
    it('should handle upgradeInsecureRequests when true', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          upgradeInsecureRequests: true,
        },
      });

      expect(result).toBe("default-src 'self'; upgrade-insecure-requests");
    });

    it('should exclude boolean directive when false', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          upgradeInsecureRequests: false,
        },
      });

      expect(result).toBe("default-src 'self'");
    });

    it('should handle blockAllMixedContent when true', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          blockAllMixedContent: true,
        },
      });

      expect(result).toBe("default-src 'self'; block-all-mixed-content");
    });

    it('should handle multiple boolean directives', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          upgradeInsecureRequests: true,
          blockAllMixedContent: true,
        },
      });

      expect(result).toBe("default-src 'self'; upgrade-insecure-requests; block-all-mixed-content");
    });

    it('should handle mixed true and false boolean directives', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          upgradeInsecureRequests: true,
          blockAllMixedContent: false,
        },
      });

      expect(result).toBe("default-src 'self'; upgrade-insecure-requests");
    });
  });

  describe('String directives', () => {
    it('should handle sandbox directive as string', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          sandbox: 'allow-forms allow-scripts',
        },
      });

      expect(result).toBe("default-src 'self'; sandbox allow-forms allow-scripts");
    });

    it('should handle reportUri as string', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          reportUri: 'https://csp-reports.example.com/report',
        },
      });

      expect(result).toBe("default-src 'self'; report-uri https://csp-reports.example.com/report");
    });

    it('should handle empty string directive', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          sandbox: '',
        },
      });

      expect(result).toBe("default-src 'self'; sandbox ");
    });
  });

  describe('CamelCase to kebab-case conversion', () => {
    it('should convert scriptSrc to script-src', () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'self'"],
        },
      });

      expect(result).toBe("script-src 'self'");
    });

    it('should convert upgradeInsecureRequests to upgrade-insecure-requests', () => {
      const result = buildCSPHeader({
        directives: {
          upgradeInsecureRequests: true,
        },
      });

      expect(result).toBe('upgrade-insecure-requests');
    });

    it('should convert frameAncestors to frame-ancestors', () => {
      const result = buildCSPHeader({
        directives: {
          frameAncestors: ["'none'"],
        },
      });

      expect(result).toBe("frame-ancestors 'none'");
    });

    it('should convert blockAllMixedContent to block-all-mixed-content', () => {
      const result = buildCSPHeader({
        directives: {
          blockAllMixedContent: true,
        },
      });

      expect(result).toBe('block-all-mixed-content');
    });

    it('should handle single-word directives', () => {
      const result = buildCSPHeader({
        directives: {
          sandbox: 'allow-forms',
        },
      });

      expect(result).toBe('sandbox allow-forms');
    });
  });

  describe('Value type handling', () => {
    it('should join array values with spaces', () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'self'", 'https://cdn1.example.com', 'https://cdn2.example.com'],
        },
      });

      expect(result).toBe("script-src 'self' https://cdn1.example.com https://cdn2.example.com");
    });

    it('should handle single-element arrays', () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'self'"],
        },
      });

      expect(result).toBe("script-src 'self'");
    });

    it('should skip empty arrays', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [],
        },
      });

      expect(result).toBe("default-src 'self'");
    });

    it('should skip undefined values', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: undefined,
        },
      });

      expect(result).toBe("default-src 'self'");
    });

    it('should handle mix of all value types', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.example.com'],
          upgradeInsecureRequests: true,
          sandbox: 'allow-forms allow-scripts',
        },
      });

      expect(result).toBe(
        "default-src 'self'; script-src 'self' https://cdn.example.com; upgrade-insecure-requests; sandbox allow-forms allow-scripts"
      );
    });
  });

  describe('Single quote preservation', () => {
    it("should preserve 'self' with quotes", () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
        },
      });

      expect(result).toContain("'self'");
      expect(result).toBe("default-src 'self'");
    });

    it("should preserve 'unsafe-inline' with quotes", () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'unsafe-inline'"],
        },
      });

      expect(result).toContain("'unsafe-inline'");
      expect(result).toBe("script-src 'unsafe-inline'");
    });

    it("should preserve 'unsafe-eval' with quotes", () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'unsafe-eval'"],
        },
      });

      expect(result).toContain("'unsafe-eval'");
      expect(result).toBe("script-src 'unsafe-eval'");
    });

    it("should preserve 'none' with quotes", () => {
      const result = buildCSPHeader({
        directives: {
          objectSrc: ["'none'"],
        },
      });

      expect(result).toContain("'none'");
      expect(result).toBe("object-src 'none'");
    });

    it('should preserve nonces with quotes', () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'self'", "'nonce-abc123'"],
        },
      });

      expect(result).toContain("'nonce-abc123'");
      expect(result).toBe("script-src 'self' 'nonce-abc123'");
    });

    it('should preserve hashes with quotes', () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'self'", "'sha256-abc123...'"],
        },
      });

      expect(result).toContain("'sha256-abc123...'");
      expect(result).toBe("script-src 'self' 'sha256-abc123...'");
    });
  });

  describe('Edge cases', () => {
    it('should handle empty directives object', () => {
      const result = buildCSPHeader({
        directives: {},
      });

      expect(result).toBe('');
    });

    it('should handle single directive', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
        },
      });

      expect(result).toBe("default-src 'self'");
    });

    it('should handle multiple directives with semicolon separator', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
        },
      });

      expect(result).toBe("default-src 'self'; script-src 'self'; style-src 'self'");
      expect(result).toContain('; ');
    });

    it('should not add trailing semicolon', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
        },
      });

      expect(result).not.toMatch(/;$/);
    });

    it('should handle directives with special characters in URLs', () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'self'", 'https://cdn.example.com/path/to/script.js?v=1.0&foo=bar'],
        },
      });

      expect(result).toBe(
        "script-src 'self' https://cdn.example.com/path/to/script.js?v=1.0&foo=bar"
      );
    });

    it('should handle data: and blob: schemes', () => {
      const result = buildCSPHeader({
        directives: {
          imgSrc: ["'self'", 'data:', 'blob:'],
        },
      });

      expect(result).toBe("img-src 'self' data: blob:");
    });

    it('should handle wildcard sources', () => {
      const result = buildCSPHeader({
        directives: {
          imgSrc: ["'self'", 'https:', '*'],
        },
      });

      expect(result).toBe("img-src 'self' https: *");
    });
  });

  describe('Real-world CSP examples', () => {
    it('should build strict production CSP', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: true,
        },
      });

      expect(result).toBe(
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; upgrade-insecure-requests"
      );
    });

    it('should build permissive development CSP', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        },
      });

      expect(result).toBe(
        "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:"
      );
    });

    it('should build CSP with CDN sources', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
          styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        },
      });

      expect(result).toBe(
        "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com"
      );
    });

    it('should build API-focused CSP (minimal)', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'none'"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: true,
        },
      });

      expect(result).toBe("default-src 'none'; connect-src 'self'; upgrade-insecure-requests");
    });

    it('should build SPA CSP with frame-ancestors', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https://api.example.com'],
          frameAncestors: ["'none'"],
        },
      });

      expect(result).toBe(
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com; frame-ancestors 'none'"
      );
    });
  });

  describe('CSP specification compliance', () => {
    it('should use semicolon-space as directive separator', () => {
      const result = buildCSPHeader({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
        },
      });

      expect(result).toContain('; ');
      expect(result.split('; ')).toHaveLength(2);
    });

    it('should use space as source separator within directives', () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'self'", 'https://cdn.example.com', 'https://api.example.com'],
        },
      });

      const directive = result.split(' ');
      expect(directive).toHaveLength(4); // directive-name + 3 sources
    });

    it('should output directive name in kebab-case', () => {
      const result = buildCSPHeader({
        directives: {
          scriptSrc: ["'self'"],
          upgradeInsecureRequests: true,
        },
      });

      expect(result).toContain('script-src');
      expect(result).toContain('upgrade-insecure-requests');
      expect(result).not.toContain('scriptSrc');
      expect(result).not.toContain('upgradeInsecureRequests');
    });

    it('should not add values to boolean directives', () => {
      const result = buildCSPHeader({
        directives: {
          upgradeInsecureRequests: true,
        },
      });

      expect(result).toBe('upgrade-insecure-requests');
      expect(result).not.toContain('upgrade-insecure-requests true');
    });
  });
});
