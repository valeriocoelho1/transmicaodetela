// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearHostToken, getHostToken, saveHostToken } from './host-token';

describe('host-token', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('writes, reads and clears the token under host-token:<roomId>', () => {
    expect(saveHostToken('room1234abcd', 'secret-token')).toBe(true);
    expect(localStorage.getItem('host-token:room1234abcd')).toBe('secret-token');
    expect(getHostToken('room1234abcd')).toBe('secret-token');
    clearHostToken('room1234abcd');
    expect(getHostToken('room1234abcd')).toBeNull();
  });

  it('survives a storage that throws', () => {
    const failing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    vi.stubGlobal('localStorage', failing);
    expect(saveHostToken('room1234abcd', 'secret-token')).toBe(false);
    expect(getHostToken('room1234abcd')).toBeNull();
    expect(() => clearHostToken('room1234abcd')).not.toThrow();
  });
});
