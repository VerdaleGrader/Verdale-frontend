import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStored, removeStored, writeStored } from './safe-storage';

afterEach(() => vi.restoreAllMocks());

describe('safe storage', () => {
  it('remembers and forgets', () => {
    expect(readStored('k')).toBeNull();
    writeStored('k', 'v');
    expect(readStored('k')).toBe('v');
    removeStored('k');
    expect(readStored('k')).toBeNull();
  });

  it('never throws when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStored('k')).toBeNull();
    expect(() => writeStored('k', 'v')).not.toThrow();
    expect(() => removeStored('k')).not.toThrow();
  });
});
