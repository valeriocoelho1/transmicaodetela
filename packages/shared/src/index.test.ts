import { describe, expect, it } from 'vitest';
import { healthResponse, ROOM_ID_REGEX } from './index';

describe('healthResponse', () => {
  it('accepts { status: "ok" }', () => {
    expect(healthResponse.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it('rejects any other payload', () => {
    expect(healthResponse.safeParse({ status: 'down' }).success).toBe(false);
    expect(healthResponse.safeParse({}).success).toBe(false);
    expect(healthResponse.safeParse(null).success).toBe(false);
  });
});

describe('ROOM_ID_REGEX', () => {
  it('accepts 12 base64url characters', () => {
    expect(ROOM_ID_REGEX.test('aZ09_-aZ09_-')).toBe(true);
  });

  it('rejects wrong length or characters', () => {
    expect(ROOM_ID_REGEX.test('abc')).toBe(false);
    expect(ROOM_ID_REGEX.test('aaaaaaaaaaaaa')).toBe(false);
    expect(ROOM_ID_REGEX.test('aaaaaaaaaaa+')).toBe(false);
    expect(ROOM_ID_REGEX.test('aaaaaaaaaaa=')).toBe(false);
  });
});
