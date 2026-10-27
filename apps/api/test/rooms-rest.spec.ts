import { roomSummaryResponse } from '@app/shared';
import request from 'supertest';
import { startApp, type TestApp } from './helpers';

describe('Rooms REST', () => {
  let t: TestApp;

  afterEach(async () => {
    await t.close();
  });

  it('1. creates a room (201) and reads it (200); unknown or malformed ids give 404', async () => {
    t = await startApp();
    const server = t.app.getHttpServer();
    const { roomId, hostToken } = await t.createRoom();
    expect(roomId).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(hostToken.length).toBeGreaterThanOrEqual(20);

    const res = await request(server).get(`/api/rooms/${roomId}`).expect(200);
    expect(roomSummaryResponse.parse(res.body)).toEqual({
      roomId,
      live: false,
      viewerCount: 0,
      maxViewers: 10,
    });
    expect(res.body).not.toHaveProperty('hostToken');

    const missing = await request(server).get('/api/rooms/aaaaaaaaaaaa').expect(404);
    expect(missing.body).toEqual({ error: 'ROOM_NOT_FOUND' });
    const malformed = await request(server).get('/api/rooms/not-valid').expect(404);
    expect(malformed.body).toEqual({ error: 'ROOM_NOT_FOUND' });
  });

  it('2. the 11th room creation in the same minute gets 429', async () => {
    t = await startApp();
    const server = t.app.getHttpServer();
    for (let i = 0; i < 10; i++) await request(server).post('/api/rooms').expect(201);
    await request(server).post('/api/rooms').expect(429);
  });

  it('answers 503 SERVER_BUSY when MAX_ROOMS is reached', async () => {
    t = await startApp({ MAX_ROOMS: '1' });
    const server = t.app.getHttpServer();
    await request(server).post('/api/rooms').expect(201);
    const res = await request(server).post('/api/rooms').expect(503);
    expect(res.body).toEqual({ error: 'SERVER_BUSY' });
  });

  it('allows CORS only for ALLOWED_ORIGINS', async () => {
    t = await startApp({ ALLOWED_ORIGINS: 'http://allowed.test' });
    const server = t.app.getHttpServer();
    const ok = await request(server).get('/api/health').set('Origin', 'http://allowed.test');
    expect(ok.headers['access-control-allow-origin']).toBe('http://allowed.test');
    const other = await request(server).get('/api/health').set('Origin', 'http://other.test');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
