import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponse } from '@app/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('GET /api/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns { status: "ok" }', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(healthResponse.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('is only served under the /api prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
