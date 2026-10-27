import { ROOM_ID_REGEX } from '@app/shared';
import { type AppConfig, loadConfig } from '../config/app-config';
import { RoomLimitReachedError, RoomsService } from './rooms.service';

describe('RoomsService', () => {
  let now: number;
  let config: AppConfig;
  let rooms: RoomsService;

  const setup = (env: Record<string, string> = {}) => {
    config = loadConfig({
      MAX_ROOMS: '3',
      MAX_VIEWERS_PER_ROOM: '2',
      ROOM_HOST_GRACE_MS: '1000',
      ROOM_UNUSED_TTL_MS: '5000',
      ROOM_MAX_AGE_MS: '20000',
      ...env,
    });
    rooms = new RoomsService(config, () => now);
  };

  beforeEach(() => {
    now = 1_000_000;
    setup();
  });

  it('creates a room with a base64url id and token', () => {
    const { roomId, hostToken } = rooms.create();
    expect(roomId).toMatch(ROOM_ID_REGEX);
    expect(hostToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rooms.summary(roomId)).toEqual({ live: false, viewerCount: 0, maxViewers: 2 });
  });

  it('stores only the token hash', () => {
    const { roomId, hostToken } = rooms.create();
    const room = rooms.get(roomId)!;
    expect(room.hostTokenHash.toString('utf8')).not.toContain(hostToken);
    expect(JSON.stringify(room)).not.toContain(hostToken);
  });

  it('refuses to create more than MAX_ROOMS', () => {
    rooms.create();
    rooms.create();
    rooms.create();
    expect(() => rooms.create()).toThrow(RoomLimitReachedError);
  });

  it('returns undefined for unknown or malformed ids', () => {
    expect(rooms.get('aaaaaaaaaaaa')).toBeUndefined();
    expect(rooms.get('../etc')).toBeUndefined();
    expect(rooms.summary('nope')).toBeUndefined();
  });

  it('verifies the host token', () => {
    const { roomId, hostToken } = rooms.create();
    expect(rooms.verifyHost(roomId, hostToken)).toBe(true);
    expect(rooms.verifyHost(roomId, `${hostToken}x`)).toBe(false);
    expect(rooms.verifyHost('aaaaaaaaaaaa', hostToken)).toBe(false);
  });

  it('attaches and detaches the host', () => {
    const { roomId } = rooms.create();
    expect(rooms.attachHost(roomId, 's1')).toEqual({ previousSocketId: null });
    rooms.setLive(roomId, true);
    expect(rooms.detachHost(roomId, 'other', false)).toBe(false);
    expect(rooms.detachHost(roomId, 's1', false)).toBe(true);
    const room = rooms.get(roomId)!;
    expect(room.hostSocketId).toBeNull();
    expect(room.hostDisconnectedAt).toBe(now);
    expect(room.live).toBe(true);
    rooms.attachHost(roomId, 's2');
    expect(room.hostDisconnectedAt).toBeNull();
    rooms.detachHost(roomId, 's2', true);
    expect(room.live).toBe(false);
  });

  it('keeps an away viewer seat and gives it back only with the resume token', () => {
    const { roomId } = rooms.create();
    const added = rooms.addViewer(roomId, 'a');
    if (!added.ok) throw new Error(added.error);
    expect(rooms.detachViewer(roomId, added.viewerId, 'other')).toBeNull();
    expect(rooms.detachViewer(roomId, added.viewerId, 'a')).toBe(now);
    expect(rooms.viewerSocketId(roomId, added.viewerId)).toBeUndefined();
    expect(rooms.end(roomId)).toEqual([]);
  });

  it('resumes a viewer with a valid token and rotates it', () => {
    const { roomId } = rooms.create();
    const added = rooms.addViewer(roomId, 'a');
    if (!added.ok) throw new Error(added.error);
    expect(rooms.resumeViewer(roomId, added.viewerId, 'x'.repeat(43), 'b')).toBeNull();
    const resumed = rooms.resumeViewer(roomId, added.viewerId, added.resumeToken, 'b');
    expect(resumed).toEqual({ previousSocketId: 'a', resumeToken: expect.any(String) });
    expect(resumed?.resumeToken).not.toBe(added.resumeToken);
    expect(rooms.viewerSocketId(roomId, added.viewerId)).toBe('b');
    expect(rooms.resumeViewer(roomId, added.viewerId, added.resumeToken, 'c')).toBeNull();
  });

  it('expires an away viewer only if it did not come back', () => {
    const { roomId } = rooms.create();
    const added = rooms.addViewer(roomId, 'a');
    if (!added.ok) throw new Error(added.error);
    const away = rooms.detachViewer(roomId, added.viewerId, 'a')!;
    rooms.resumeViewer(roomId, added.viewerId, added.resumeToken, 'b');
    expect(rooms.expireViewer(roomId, added.viewerId, away)).toBe(false);
    const again = rooms.detachViewer(roomId, added.viewerId, 'b')!;
    expect(rooms.expireViewer(roomId, added.viewerId, again)).toBe(true);
    expect(rooms.summary(roomId)?.viewerCount).toBe(0);
  });

  it('returns the previous socket when the host is replaced', () => {
    const { roomId } = rooms.create();
    rooms.attachHost(roomId, 's1');
    expect(rooms.attachHost(roomId, 's2')).toEqual({ previousSocketId: 's1' });
    expect(rooms.attachHost(roomId, 's2')).toEqual({ previousSocketId: null });
  });

  it('limits viewers per room', () => {
    const { roomId } = rooms.create();
    const a = rooms.addViewer(roomId, 'a');
    const b = rooms.addViewer(roomId, 'b');
    expect(a.ok && b.ok).toBe(true);
    expect(rooms.addViewer(roomId, 'c')).toEqual({ ok: false, error: 'ROOM_FULL' });
    if (a.ok) {
      expect(rooms.viewerSocketId(roomId, a.viewerId)).toBe('a');
      expect(rooms.removeViewer(roomId, a.viewerId)).toBe(true);
      expect(rooms.removeViewer(roomId, a.viewerId)).toBe(false);
    }
    expect(rooms.addViewer(roomId, 'c').ok).toBe(true);
    expect(rooms.addViewer('aaaaaaaaaaaa', 'd')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('ends a room and returns the viewer sockets', () => {
    const { roomId } = rooms.create();
    rooms.addViewer(roomId, 'a');
    expect(rooms.end(roomId)).toEqual(['a']);
    expect(rooms.get(roomId)).toBeUndefined();
    expect(rooms.end(roomId)).toEqual([]);
  });

  it('expires with HOST_TIMEOUT after the grace period', () => {
    const { roomId } = rooms.create();
    rooms.attachHost(roomId, 's1');
    rooms.detachHost(roomId, 's1', false);
    expect(rooms.findExpired(now + 999)).toEqual([]);
    expect(rooms.findExpired(now + 1000)).toEqual([{ roomId, reason: 'HOST_TIMEOUT' }]);
  });

  it('does not expire while the host is connected', () => {
    const { roomId } = rooms.create();
    rooms.attachHost(roomId, 's1');
    expect(rooms.findExpired(now + 10_000)).toEqual([]);
  });

  it('expires an unused room after ROOM_UNUSED_TTL_MS', () => {
    const { roomId } = rooms.create();
    expect(rooms.findExpired(now + 4999)).toEqual([]);
    expect(rooms.findExpired(now + 5000)).toEqual([{ roomId, reason: 'EXPIRED' }]);
  });

  it('expires any room after ROOM_MAX_AGE_MS', () => {
    const { roomId } = rooms.create();
    rooms.attachHost(roomId, 's1');
    expect(rooms.findExpired(now + 19_999)).toEqual([]);
    expect(rooms.findExpired(now + 20_000)).toEqual([{ roomId, reason: 'EXPIRED' }]);
  });
});
