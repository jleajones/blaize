import { BlaizeLogger } from '../../../blaize-types/src';

export function createMockLogger(): BlaizeLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
    flush: vi.fn(async () => {}),
  };
}
