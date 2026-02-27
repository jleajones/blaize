/**
 * Unit Tests for defineJob()
 *
 * Tests validate runtime checks and the shape of the returned definition.
 */
import { z } from 'zod';
import { defineJob } from '../define-job';

const validHandler = async () => ({ ok: true });

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    input: z.object({ name: z.string() }),
    output: z.object({ ok: z.boolean() }),
    handler: validHandler,
    ...overrides,
  };
}

describe('defineJob()', () => {
  describe('valid definitions', () => {
    it('returns a frozen object with _type "definition"', () => {
      const def = defineJob(makeConfig());
      expect(def._type).toBe('definition');
      expect(Object.isFrozen(def)).toBe(true);
    });

    it('preserves input, output, and handler', () => {
      const input = z.object({ x: z.number() });
      const output = z.object({ y: z.string() });
      const handler = async () => ({ y: 'hello' });

      const def = defineJob({ input, output, handler });
      expect(def.input).toBe(input);
      expect(def.output).toBe(output);
      expect(def.handler).toBe(handler);
    });
  });

  describe('input validation', () => {
    it('throws if input is not a Zod schema', () => {
      expect(() => defineJob(makeConfig({ input: 'not-a-schema' }) as any)).toThrow(
        'defineJob: "input" must be a Zod schema'
      );
    });

    it('throws if input is null', () => {
      expect(() => defineJob(makeConfig({ input: null }) as any)).toThrow(
        'defineJob: "input" must be a Zod schema'
      );
    });

    it('throws if input is a plain object without _def', () => {
      expect(() =>
        defineJob(makeConfig({ input: { parse: () => {} } }) as any)
      ).toThrow('defineJob: "input" must be a Zod schema');
    });

    it('throws if input has _def but parse is not a function', () => {
      expect(() =>
        defineJob(makeConfig({ input: { _def: {}, parse: 'nope' } }) as any)
      ).toThrow('defineJob: "input" must be a Zod schema');
    });
  });

  describe('output validation', () => {
    it('throws if output is not a Zod schema', () => {
      expect(() => defineJob(makeConfig({ output: 42 }) as any)).toThrow(
        'defineJob: "output" must be a Zod schema'
      );
    });

    it('throws if output is undefined', () => {
      expect(() => defineJob(makeConfig({ output: undefined }) as any)).toThrow(
        'defineJob: "output" must be a Zod schema'
      );
    });
  });

  describe('handler validation', () => {
    it('throws if handler is not a function', () => {
      expect(() => defineJob(makeConfig({ handler: 'not-fn' }) as any)).toThrow(
        'defineJob: "handler" must be a function'
      );
    });

    it('throws if handler is null', () => {
      expect(() => defineJob(makeConfig({ handler: null }) as any)).toThrow(
        'defineJob: "handler" must be a function'
      );
    });
  });

  describe('various Zod schema types', () => {
    const schemas = [
      ['z.string()', z.string(), z.string()],
      ['z.number()', z.number(), z.number()],
      ['z.boolean()', z.boolean(), z.boolean()],
      ['z.array(z.string())', z.array(z.string()), z.array(z.number())],
      ['z.object (nested)', z.object({ a: z.object({ b: z.string() }) }), z.object({ c: z.number() })],
      ['z.enum', z.enum(['a', 'b']), z.enum(['x', 'y'])],
      ['z.optional', z.string().optional(), z.number().optional()],
      ['z.default', z.string().default('hi'), z.number().default(0)],
      ['z.transform', z.string().transform((s) => s.length), z.number()],
    ] as const;

    it.each(schemas)('works with %s', (_label, input, output) => {
      const def = defineJob({ input, output, handler: async () => ({}) as any });
      expect(def._type).toBe('definition');
      expect(def.input).toBe(input);
      expect(def.output).toBe(output);
      expect(Object.isFrozen(def)).toBe(true);
    });
  });
});

