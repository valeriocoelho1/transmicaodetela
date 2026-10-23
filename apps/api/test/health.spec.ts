import { healthResponse } from '@app/shared';
import request from 'supertest';
import { startApp, type TestApp } from './helpers';

describe('GET /api/health', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('returns { status: "ok" }', async () => {
    const res = await request(t.app.getHttpServer()).get('/api/health').expect(200);
    expect(healthResponse.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('is only served under the /api prefix', async () => {
    await request(t.app.getHttpServer()).get('/health').expect(404);
  });

  it('sends helmet security headers', async () => {
    const res = await request(t.app.getHttpServer()).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
