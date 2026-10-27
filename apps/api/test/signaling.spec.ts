import type { HostJoinAck, IceCandidate, ViewerJoinAck } from '@app/shared';
import request from 'supertest';
import {
  type ClientSocket,
  recordEvents,
  startApp,
  type TestApp,
  waitForEvent,
  waitUntil,
} from './helpers';

const offerSdp = { type: 'offer' as const, sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=offer\r\n' };
const answerSdp = {
  type: 'answer' as const,
  sdp: 'v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\ns=answer\r\n',
};
const candidate: IceCandidate = {
  candidate: 'candidate:1 1 udp 2122260223 192.0.2.10 54400 typ host',
  sdpMid: '0',
  sdpMLineIndex: 0,
  usernameFragment: 'abcd',
};

describe('SignalingGateway', () => {
  let t: TestApp;

  afterEach(async () => {
    await t.close();
  });

  async function joinHost(roomId: string, hostToken: string) {
    const host = await t.connect();
    const events = recordEvents(host);
    const ack: HostJoinAck = await host.emitWithAck('host:join', { roomId, hostToken });
    return { host, events, ack };
  }

  async function joinViewer(roomId: string) {
    const viewer = await t.connect();
    const events = recordEvents(viewer);
    const ack: ViewerJoinAck = await viewer.emitWithAck('viewer:join', { roomId });
    if (!ack.ok) throw new Error(`viewer:join failed: ${ack.error}`);
    return { viewer, events, viewerId: ack.viewerId, ack };
  }

  async function roomStatus(roomId: string) {
    return request(t.app.getHttpServer()).get(`/api/rooms/${roomId}`);
  }

  it('3. host:join with a valid token acks with iceServers and no viewers', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { ack } = await joinHost(room.roomId, room.hostToken);
    expect(ack).toEqual({
      ok: true,
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      viewers: [],
      maxViewers: 10,
    });
  });

  it('4. host:join rejects a wrong token, a missing room and an invalid payload', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const socket = await t.connect();
    const wrongToken = room.hostToken.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    expect(
      await socket.emitWithAck('host:join', { roomId: room.roomId, hostToken: wrongToken }),
    ).toEqual({ ok: false, error: 'INVALID_TOKEN' });
    expect(
      await socket.emitWithAck('host:join', { roomId: 'aaaaaaaaaaaa', hostToken: room.hostToken }),
    ).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    expect(await socket.emitWithAck('host:join', { roomId: room.roomId } as never)).toEqual({
      ok: false,
      error: 'INVALID_PAYLOAD',
    });
    expect(await socket.emitWithAck('viewer:join', { roomId: 42 } as never)).toEqual({
      ok: false,
      error: 'INVALID_PAYLOAD',
    });
    expect(socket.connected).toBe(true);
  });

  it('5. viewer:join acks with live=false and the host gets viewer:joined', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const joined = waitForEvent<{ viewerId: string }>(host, 'viewer:joined');
    const { ack, viewerId } = await joinViewer(room.roomId);
    expect(ack).toEqual({
      ok: true,
      viewerId,
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      resumeToken: expect.any(String),
      resumed: false,
      live: false,
      host: { name: 'Anfitrião', avatar: 'kitten', online: true },
      selfId: expect.any(String),
      viewers: [{ id: expect.any(String), name: 'Espectador', avatar: 'kitten' }],
      maxViewers: 10,
    });
    expect(await joined).toEqual({ viewerId, name: 'Espectador', avatar: 'kitten' });
    expect((await roomStatus(room.roomId)).body.viewerCount).toBe(1);
  });

  it('6. a full room answers ROOM_FULL', async () => {
    t = await startApp({ MAX_VIEWERS_PER_ROOM: '2' });
    const room = await t.createRoom();
    await joinViewer(room.roomId);
    await joinViewer(room.roomId);
    const third = await t.connect();
    expect(await third.emitWithAck('viewer:join', { roomId: room.roomId })).toEqual({
      ok: false,
      error: 'ROOM_FULL',
    });
  });

  it('7. relays offer, answer and ICE in both directions without logging them', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const { viewer, viewerId } = await joinViewer(room.roomId);

    const offer = waitForEvent(viewer, 'signal:offer');
    host.emit('signal:offer', { viewerId, sdp: offerSdp });
    expect(await offer).toEqual({ sdp: offerSdp });

    const answer = waitForEvent(host, 'signal:answer');
    viewer.emit('signal:answer', { sdp: answerSdp });
    expect(await answer).toEqual({ viewerId, sdp: answerSdp });

    const iceAtViewer = waitForEvent(viewer, 'signal:ice');
    host.emit('signal:ice', { viewerId, candidate });
    expect(await iceAtViewer).toEqual({ candidate });

    const iceAtHost = waitForEvent(host, 'signal:ice');
    viewer.emit('signal:ice', { candidate });
    expect(await iceAtHost).toEqual({ viewerId, candidate });

    const logs = t.logger.lines.join('\n');
    expect(logs).toContain('viewer joined');
    for (const secret of [offerSdp.sdp, answerSdp.sdp, candidate.candidate, room.hostToken]) {
      expect(logs).not.toContain(secret);
    }
    expect(logs).not.toContain('192.0.2.10');
    expect(logs).not.toContain(room.roomId);
  });

  it('8. ignores events sent by the wrong role and offers to unknown viewers', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { host, events: hostEvents } = await joinHost(room.roomId, room.hostToken);
    const a = await joinViewer(room.roomId);
    const b = await joinViewer(room.roomId);

    a.viewer.emit('signal:offer', { viewerId: b.viewerId, sdp: offerSdp });
    a.viewer.emit('host:live', { live: true });
    a.viewer.emit('host:end');
    // A viewer cannot target another viewer: the server forwards to the host with A's own id.
    a.viewer.emit('signal:ice', { viewerId: b.viewerId, candidate } as never);
    host.emit('signal:answer', { sdp: answerSdp });
    host.emit('signal:offer', { viewerId: '3b241101-e2bb-4255-8caf-4136c566a962', sdp: offerSdp });

    const answerFromA = waitForEvent(host, 'signal:answer');
    a.viewer.emit('signal:answer', { sdp: answerSdp });
    expect(await answerFromA).toEqual({ viewerId: a.viewerId, sdp: answerSdp });

    const offerToB = waitForEvent(b.viewer, 'signal:offer');
    host.emit('signal:offer', { viewerId: b.viewerId, sdp: offerSdp });
    await offerToB;

    expect(hostEvents).toEqual([
      ['viewer:joined', { viewerId: a.viewerId, name: 'Espectador', avatar: 'kitten' }],
      ['viewer:joined', { viewerId: b.viewerId, name: 'Espectador', avatar: 'kitten' }],
      ['signal:ice', { viewerId: a.viewerId, candidate }],
      ['signal:answer', { viewerId: a.viewerId, sdp: answerSdp }],
    ]);
    expect(b.events).toEqual([['signal:offer', { sdp: offerSdp }]]);
    expect(a.events.map(([event]) => event)).toEqual(['room:viewers']);
    expect((await roomStatus(room.roomId)).status).toBe(200);
  });

  it('9. host:live reaches viewers as room:status and late viewers get the live flag', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const { viewer } = await joinViewer(room.roomId);

    const on = waitForEvent(viewer, 'room:status');
    host.emit('host:live', { live: true });
    expect(await on).toEqual({ live: true });

    const late = await joinViewer(room.roomId);
    expect(late.ack.ok && late.ack.live).toBe(true);

    const off = waitForEvent(viewer, 'room:status');
    host.emit('host:live', { live: false });
    expect(await off).toEqual({ live: false });
  });

  it('10. a viewer disconnecting sends viewer:left to the host', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const { viewer, viewerId } = await joinViewer(room.roomId);
    const left = waitForEvent(host, 'viewer:left');
    viewer.disconnect();
    expect(await left).toEqual({ viewerId });
    expect((await roomStatus(room.roomId)).body.viewerCount).toBe(0);
  });

  it('11. host disconnect: live=false, then HOST_TIMEOUT after the grace period', async () => {
    t = await startApp({ ROOM_HOST_GRACE_MS: '200', SWEEP_INTERVAL_MS: '50' });
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const { viewer } = await joinViewer(room.roomId);
    host.emit('host:live', { live: true });
    await waitForEvent(viewer, 'room:status');

    const status = waitForEvent(viewer, 'room:status');
    const ended = waitForEvent(viewer, 'room:ended');
    const disconnected = waitForEvent(viewer, 'disconnect');
    host.disconnect();
    expect(await status).toEqual({ live: false });
    expect(await ended).toEqual({ reason: 'HOST_TIMEOUT' });
    await disconnected;
    expect((await roomStatus(room.roomId)).status).toBe(404);
  });

  it('12. a host reconnecting within the grace period keeps the room', async () => {
    t = await startApp({ ROOM_HOST_GRACE_MS: '400', SWEEP_INTERVAL_MS: '50' });
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const { viewer, viewerId, events } = await joinViewer(room.roomId);
    const status = waitForEvent(viewer, 'room:status');
    host.disconnect();
    await status;

    const again = await joinHost(room.roomId, room.hostToken);
    expect(again.ack).toMatchObject({
      ok: true,
      viewers: [{ viewerId, name: 'Espectador', avatar: 'kitten' }],
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect((await roomStatus(room.roomId)).status).toBe(200);
    expect(events.map(([event]) => event)).not.toContain('room:ended');
  });

  it('13. host:end sends HOST_ENDED to viewers and removes the room', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const { viewer } = await joinViewer(room.roomId);
    const ended = waitForEvent(viewer, 'room:ended');
    const disconnected = waitForEvent(viewer, 'disconnect');
    host.emit('host:end');
    expect(await ended).toEqual({ reason: 'HOST_ENDED' });
    await disconnected;
    expect((await roomStatus(room.roomId)).status).toBe(404);
  });

  it('14. a second host:join with the same token replaces the first host', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const first = await joinHost(room.roomId, room.hostToken);
    const replaced = waitForEvent(first.host, 'room:host-replaced');
    const disconnected = waitForEvent(first.host, 'disconnect');
    const second = await joinHost(room.roomId, room.hostToken);
    expect(second.ack.ok).toBe(true);
    await replaced;
    await disconnected;

    const { viewer } = await joinViewer(room.roomId);
    const status = waitForEvent(viewer, 'room:status');
    second.host.emit('host:live', { live: true });
    expect(await status).toEqual({ live: true });
  });

  it('15. refuses a connection from an origin that is not allowed', async () => {
    t = await startApp({ ALLOWED_ORIGINS: 'http://allowed.test' });
    await expect(t.connect({ origin: 'http://evil.test' })).rejects.toThrow();
    const ok = await t.connect({ origin: 'http://allowed.test' });
    expect(ok.connected).toBe(true);
  });

  it('16. disconnects a socket that exceeds the event rate limit', async () => {
    t = await startApp({ SOCKET_RATE_LIMIT_EVENTS: '5', SOCKET_RATE_LIMIT_WINDOW_MS: '10000' });
    const socket: ClientSocket = await t.connect();
    const disconnected = waitForEvent(socket, 'disconnect');
    for (let i = 0; i < 10; i++) socket.emit('host:live', { live: true });
    expect(await disconnected).toBe('io server disconnect');
  });

  it('17. removes a room whose host never joined after ROOM_UNUSED_TTL_MS', async () => {
    t = await startApp({ ROOM_UNUSED_TTL_MS: '150', SWEEP_INTERVAL_MS: '50' });
    const room = await t.createRoom();
    expect((await roomStatus(room.roomId)).status).toBe(200);
    await waitUntil(async () => (await roomStatus(room.roomId)).status === 404);
  });

  it('18. shares names and profile avatars on join and relays profile changes', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const host = await t.connect();
    await host.emitWithAck('host:join', { ...room, name: '  Ana  ', avatar: 'pointing' });

    const joined = waitForEvent(host, 'viewer:joined');
    const viewer = await t.connect();
    const ack: ViewerJoinAck = await viewer.emitWithAck('viewer:join', {
      roomId: room.roomId,
      name: 'Bia',
      avatar: 'dancing',
    });
    if (!ack.ok) throw new Error(ack.error);
    expect(ack.host).toEqual({ name: 'Ana', avatar: 'pointing', online: true });
    expect(await joined).toEqual({ viewerId: ack.viewerId, name: 'Bia', avatar: 'dancing' });

    const updated = waitForEvent(host, 'viewer:updated');
    viewer.emit('user:profile', { name: 'Bianca', avatar: 'tongue' });
    expect(await updated).toEqual({ viewerId: ack.viewerId, name: 'Bianca', avatar: 'tongue' });

    const hostName = waitForEvent(viewer, 'room:host');
    host.emit('user:profile', { name: 'Ana Paula', avatar: 'kitten' });
    expect(await hostName).toEqual({ name: 'Ana Paula', avatar: 'kitten', online: true });

    const again: HostJoinAck = await (
      await t.connect()
    ).emitWithAck('host:join', { roomId: room.roomId, hostToken: room.hostToken });
    expect(again).toMatchObject({
      viewers: [{ viewerId: ack.viewerId, name: 'Bianca', avatar: 'tongue' }],
    });
    expect(t.logger.lines.join('\n')).not.toMatch(/Bianca|Ana Paula/);
  });

  it('20. viewers see each other by display id, never by viewerId', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const a = await joinViewer(room.roomId);
    const listAtA = waitForEvent<{ viewers: { id: string; name: string }[] }>(
      a.viewer,
      'room:viewers',
    );
    const b = await joinViewer(room.roomId);
    expect(b.ack.viewers).toEqual([
      { id: a.ack.selfId, name: 'Espectador', avatar: 'kitten' },
      { id: b.ack.selfId, name: 'Espectador', avatar: 'kitten' },
    ]);
    expect((await listAtA).viewers).toEqual(b.ack.viewers);
    expect(JSON.stringify(b.ack.viewers)).not.toContain(a.viewerId);
    expect(b.events).toEqual([]);

    const renamed = waitForEvent<{ viewers: { id: string; name: string }[] }>(
      a.viewer,
      'room:viewers',
    );
    b.viewer.emit('user:profile', { name: 'Bia', avatar: 'pointing' });
    expect((await renamed).viewers[1]).toEqual({
      id: b.ack.selfId,
      name: 'Bia',
      avatar: 'pointing',
    });

    const left = waitForEvent<{ viewers: { id: string; name: string }[] }>(
      a.viewer,
      'room:viewers',
    );
    b.viewer.disconnect();
    expect((await left).viewers).toEqual([
      { id: a.ack.selfId, name: 'Espectador', avatar: 'kitten' },
    ]);
  });

  // Closing the transport looks like a lost network to the server, unlike socket.disconnect().
  function dropConnection(socket: ClientSocket) {
    (socket.io.engine as unknown as { close(): void }).close();
  }

  it('21. a viewer that loses the connection keeps its seat and resumes with its token', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { host, events: hostEvents } = await joinHost(room.roomId, room.hostToken);
    const { viewer, viewerId, ack } = await joinViewer(room.roomId);
    hostEvents.length = 0;

    dropConnection(viewer);
    await waitUntil(async () => t.logger.lines.some((line) => line.includes('viewer away')));
    expect((await roomStatus(room.roomId)).body.viewerCount).toBe(1);

    const back = await t.connect();
    const resumed: ViewerJoinAck = await back.emitWithAck('viewer:join', {
      roomId: room.roomId,
      resume: { viewerId, token: ack.resumeToken, needsOffer: false },
    });
    if (!resumed.ok) throw new Error(resumed.error);
    expect(resumed).toMatchObject({ viewerId, resumed: true, selfId: ack.selfId });
    expect(resumed.resumeToken).not.toBe(ack.resumeToken);

    const offer = waitForEvent(back, 'signal:offer');
    host.emit('signal:offer', { viewerId, sdp: offerSdp });
    expect(await offer).toEqual({ sdp: offerSdp });
    expect(hostEvents).toEqual([]);
    expect(t.logger.lines.join('\n')).not.toContain(ack.resumeToken);
  });

  it('22. a resumed viewer that lost its video asks the host for a new offer', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const { viewer, viewerId, ack } = await joinViewer(room.roomId);
    dropConnection(viewer);
    await waitUntil(async () => t.logger.lines.some((line) => line.includes('viewer away')));

    const joinedAgain = waitForEvent(host, 'viewer:joined');
    const back = await t.connect();
    await back.emitWithAck('viewer:join', {
      roomId: room.roomId,
      resume: { viewerId, token: ack.resumeToken, needsOffer: true },
    });
    expect(await joinedAgain).toEqual({ viewerId, name: 'Espectador', avatar: 'kitten' });
  });

  it('23. an away viewer is removed after VIEWER_GRACE_MS and a wrong token gets a new seat', async () => {
    t = await startApp({ VIEWER_GRACE_MS: '150' });
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const { viewer, viewerId, ack } = await joinViewer(room.roomId);

    const left = waitForEvent(host, 'viewer:left');
    dropConnection(viewer);
    expect(await left).toEqual({ viewerId });

    const late = await t.connect();
    const fresh: ViewerJoinAck = await late.emitWithAck('viewer:join', {
      roomId: room.roomId,
      resume: { viewerId, token: ack.resumeToken, needsOffer: true },
    });
    expect(fresh).toMatchObject({ ok: true, resumed: false });
    if (fresh.ok) expect(fresh.viewerId).not.toBe(viewerId);
  });

  it('24. a host that loses the connection stays live and viewers see it go offline', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const { host } = await joinHost(room.roomId, room.hostToken);
    const { viewer, events } = await joinViewer(room.roomId);
    host.emit('host:live', { live: true });
    await waitForEvent(viewer, 'room:status');
    events.length = 0;

    const offline = waitForEvent(viewer, 'room:host');
    dropConnection(host);
    expect(await offline).toEqual({ name: 'Anfitrião', avatar: 'kitten', online: false });
    expect((await roomStatus(room.roomId)).body.live).toBe(true);

    const online = waitForEvent(viewer, 'room:host');
    await joinHost(room.roomId, room.hostToken);
    expect(await online).toEqual({ name: 'Anfitrião', avatar: 'kitten', online: true });
    expect(events.map(([event]) => event)).not.toContain('room:status');
  });

  it('25. rejects an avatar outside the presets', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const socket = await t.connect();
    expect(
      await socket.emitWithAck('viewer:join', { roomId: room.roomId, avatar: 'confetti' } as never),
    ).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
  });

  it('19. rejects empty, oversized or control-character names', async () => {
    t = await startApp();
    const room = await t.createRoom();
    const socket = await t.connect();
    for (const name of ['   ', 'x'.repeat(33), 'a\u0000b']) {
      expect(await socket.emitWithAck('viewer:join', { roomId: room.roomId, name })).toEqual({
        ok: false,
        error: 'INVALID_PAYLOAD',
      });
    }
  });

  it('drops an oversized message without crashing', async () => {
    t = await startApp();
    const socket = await t.connect();
    const disconnected = waitForEvent(socket, 'disconnect');
    socket.emit('signal:answer', { sdp: { type: 'answer', sdp: 'a'.repeat(70_000) } });
    await disconnected;
    const health = await request(t.app.getHttpServer()).get('/api/health');
    expect(health.status).toBe(200);
  });
});
