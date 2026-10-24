import type { HostJoinAck, ViewerJoinAck } from '@app/shared';
import request from 'supertest';
import { type ClientSocket, recordEvents, startApp, type TestApp, waitForEvent } from './helpers';

// Mirrors the security checklist in docs/arquitetura/06-seguranca-e-limites.md.
describe('Security checklist', () => {
  let t: TestApp;

  afterEach(async () => {
    await t.close();
  });

  async function hostAndViewer() {
    const room = await t.createRoom();
    const host = await t.connect();
    const hostEvents = recordEvents(host);
    const hostAck: HostJoinAck = await host.emitWithAck('host:join', room);
    expect(hostAck.ok).toBe(true);
    const viewer = await t.connect();
    const viewerAck: ViewerJoinAck = await viewer.emitWithAck('viewer:join', {
      roomId: room.roomId,
    });
    if (!viewerAck.ok) throw new Error(viewerAck.error);
    return { room, host, hostEvents, viewer, viewerId: viewerAck.viewerId };
  }

  it('refuses a Socket.IO handshake from an origin that is not allowed', async () => {
    t = await startApp({ ALLOWED_ORIGINS: 'https://allowed.test' });
    await expect(t.connect({ origin: 'https://evil.test' })).rejects.toThrow();
    await expect(t.connect({ origin: 'https://allowed.test.evil.test' })).rejects.toThrow();
  });

  it('ignores signal:offer, host:live and host:end sent by a viewer', async () => {
    t = await startApp();
    const { room, host, hostEvents, viewer, viewerId } = await hostAndViewer();
    const viewerEvents = recordEvents(viewer);

    viewer.emit('signal:offer', { viewerId, sdp: { type: 'offer', sdp: 'v=0' } });
    viewer.emit('host:live', { live: true });
    viewer.emit('host:end');
    const sentinel = waitForEvent(host, 'signal:answer');
    viewer.emit('signal:answer', { sdp: { type: 'answer', sdp: 'v=0' } });
    await sentinel;

    expect(viewerEvents).toEqual([]);
    expect(hostEvents.map(([event]) => event)).toEqual(['viewer:joined', 'signal:answer']);
    const res = await request(t.app.getHttpServer()).get(`/api/rooms/${room.roomId}`).expect(200);
    expect(res.body.live).toBe(false);
  });

  it('refuses a wrong host token and never exposes the token', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const socket = await t.connect();
    const last = room.hostToken.at(-1) === 'A' ? 'B' : 'A';
    const almostRight = `${room.hostToken.slice(0, -1)}${last}`;
    for (const hostToken of ['x'.repeat(43), almostRight, 'short']) {
      const ack = await socket.emitWithAck('host:join', { roomId: room.roomId, hostToken });
      expect(ack.ok).toBe(false);
    }
    const res = await request(t.app.getHttpServer()).get(`/api/rooms/${room.roomId}`).expect(200);
    expect(JSON.stringify(res.body)).not.toContain(room.hostToken);
    expect(Object.keys(res.body).sort()).toEqual(['live', 'maxViewers', 'roomId', 'viewerCount']);
  });

  it('survives invalid payloads and keeps answering on the same socket', async () => {
    t = await startApp();
    const { room, host, viewer } = await hostAndViewer();
    const weird: unknown[] = [
      null,
      42,
      'text',
      [],
      [{ roomId: room.roomId }],
      { roomId: { $gt: '' } },
      JSON.parse('{"__proto__": {"polluted": true}, "roomId": 7, "hostToken": 1}'),
      { sdp: { type: 'answer', sdp: 'a'.repeat(40_000) } },
      { candidate: { candidate: 'c'.repeat(3_000) } },
      { viewerId: '../../etc', sdp: { type: 'offer', sdp: 'v=0' } },
    ];
    const untypedHost = host as unknown as { emit(event: string, payload: unknown): void };
    const untypedViewer = viewer as unknown as { emit(event: string, payload: unknown): void };
    for (const payload of weird) {
      for (const event of ['signal:offer', 'signal:ice', 'host:live']) {
        untypedHost.emit(event, payload);
      }
      for (const event of ['signal:answer', 'signal:ice']) untypedViewer.emit(event, payload);
      const hostAck = await (host as ClientSocket).emitWithAck('host:join', payload as never);
      expect(hostAck).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
      const viewerAck = await (viewer as ClientSocket).emitWithAck('viewer:join', payload as never);
      expect(viewerAck).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
    }

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const status = waitForEvent(viewer, 'room:status');
    host.emit('host:live', { live: true });
    expect(await status).toEqual({ live: true });
    expect(host.connected && viewer.connected).toBe(true);
    await request(t.app.getHttpServer()).get('/api/health').expect(200);
  });

  it('disconnects a socket that sends a message above 64 KB, and the server keeps working', async () => {
    t = await startApp();
    const socket = await t.connect();
    const disconnected = waitForEvent(socket, 'disconnect');
    socket.emit('signal:answer', { sdp: { type: 'answer', sdp: 'a'.repeat(70_000) } });
    await disconnected;
    const other = await t.connect();
    const room = await t.createRoom();
    const ack: ViewerJoinAck = await other.emitWithAck('viewer:join', { roomId: room.roomId });
    expect(ack.ok).toBe(true);
  });

  it('disconnects a socket that exceeds the event rate limit', async () => {
    t = await startApp({ SOCKET_RATE_LIMIT_EVENTS: '20', SOCKET_RATE_LIMIT_WINDOW_MS: '10000' });
    const socket = await t.connect();
    const disconnected = waitForEvent(socket, 'disconnect');
    for (let i = 0; i < 30; i++) socket.emit('host:end');
    expect(await disconnected).toBe('io server disconnect');
    const fresh = await t.connect();
    expect(fresh.connected).toBe(true);
  });
});
