import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createRoom, getRoom } from './api';

const respond = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(body, { status })),
  );

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a room and validates the response', async () => {
    respond(201, { roomId: 'aZ09_-aZ09_-', hostToken: 'x'.repeat(43) });
    await expect(createRoom()).resolves.toEqual({
      roomId: 'aZ09_-aZ09_-',
      hostToken: 'x'.repeat(43),
    });
  });

  it.each([
    [429, 'rate_limited'],
    [503, 'server_busy'],
    [500, 'unknown'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    respond(status, {});
    await expect(createRoom()).rejects.toEqual(new ApiError(kind as ApiError['kind']));
  });

  it('rejects a malformed create response', async () => {
    respond(201, { roomId: 'bad' });
    await expect(createRoom()).rejects.toBeInstanceOf(ApiError);
  });

  it('returns null for a missing room', async () => {
    respond(404, { error: 'ROOM_NOT_FOUND' });
    await expect(getRoom('aZ09_-aZ09_-')).resolves.toBeNull();
  });

  it('returns the room summary', async () => {
    const summary = { roomId: 'aZ09_-aZ09_-', live: true, viewerCount: 1, maxViewers: 5 };
    respond(200, summary);
    await expect(getRoom('aZ09_-aZ09_-')).resolves.toEqual(summary);
  });
});
