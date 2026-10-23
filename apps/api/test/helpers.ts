import 'reflect-metadata';
import type { LoggerService } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  type ClientToServerEvents,
  type CreateRoomResponse,
  createRoomResponse,
  type ServerToClientEvents,
} from '@app/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG, loadConfig } from '../src/config/app-config';
import { configureApp } from '../src/configure-app';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type EventName = keyof ServerToClientEvents | 'disconnect' | 'connect_error';

export class CapturingLogger implements LoggerService {
  readonly lines: string[] = [];
  log(...args: unknown[]) {
    this.lines.push(args.map(String).join(' '));
  }
  error(...args: unknown[]) {
    this.log(...args);
  }
  warn(...args: unknown[]) {
    this.log(...args);
  }
  debug(...args: unknown[]) {
    this.log(...args);
  }
  verbose(...args: unknown[]) {
    this.log(...args);
  }
}

export interface TestApp {
  app: NestExpressApplication;
  url: string;
  logger: CapturingLogger;
  connect(options?: { origin?: string }): Promise<ClientSocket>;
  createRoom(): Promise<CreateRoomResponse>;
  close(): Promise<void>;
}

export async function startApp(env: Record<string, string> = {}): Promise<TestApp> {
  const config = loadConfig({ NODE_ENV: 'test', ...env });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .compile();
  const logger = new CapturingLogger();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger });
  configureApp(app, config);
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  const sockets: ClientSocket[] = [];

  return {
    app,
    url,
    logger,
    async connect(options = {}) {
      const socket: ClientSocket = io(url, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
        extraHeaders: options.origin ? { origin: options.origin } : undefined,
      });
      sockets.push(socket);
      await waitForEvent(socket, 'connect' as EventName);
      return socket;
    },
    async createRoom() {
      const res = await request(app.getHttpServer()).post('/api/rooms').expect(201);
      return createRoomResponse.parse(res.body);
    },
    async close() {
      for (const socket of sockets) socket.disconnect();
      await app.close();
    },
  };
}

export function waitForEvent<T = unknown>(
  socket: ClientSocket,
  event: EventName,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const untyped = socket as unknown as {
      once(event: string, listener: (payload: T) => void): void;
      off(event: string, listener: (payload: T) => void): void;
    };
    const timer = setTimeout(() => {
      untyped.off(event, listener);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    const listener = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    untyped.once(event, listener);
  });
}

export function recordEvents(socket: ClientSocket): [string, unknown][] {
  const events: [string, unknown][] = [];
  socket.onAny((event: string, payload: unknown) => events.push([event, payload]));
  return events;
}

export async function waitUntil(check: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('Condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
