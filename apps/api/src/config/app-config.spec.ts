import { loadConfig } from './app-config';

describe('loadConfig', () => {
  it('applies the documented defaults', () => {
    const config = loadConfig({});
    expect(config).toEqual({
      nodeEnv: 'development',
      port: 3000,
      allowedOrigins: ['http://localhost:5173'],
      trustProxy: 0,
      maxViewersPerRoom: 5,
      maxRooms: 50,
      roomHostGraceMs: 60_000,
      viewerGraceMs: 20_000,
      roomUnusedTtlMs: 900_000,
      roomMaxAgeMs: 43_200_000,
      sweepIntervalMs: 30_000,
      stunUrls: ['stun:stun.l.google.com:19302'],
      turnUrls: [],
      turnSecret: undefined,
      turnCredentialTtlSeconds: 43_200,
      socketRateLimitEvents: 300,
      socketRateLimitWindowMs: 10_000,
      maxSocketsPerIp: 20,
    });
  });

  it('parses numbers and comma-separated lists', () => {
    const config = loadConfig({
      PORT: '8080',
      MAX_VIEWERS_PER_ROOM: '2',
      ALLOWED_ORIGINS: 'https://a.test, https://b.test',
      TURN_URLS: 'turn:a.test:3478?transport=udp,turn:a.test:3478?transport=tcp',
      TURN_SECRET: 'secret',
    });
    expect(config.port).toBe(8080);
    expect(config.maxViewersPerRoom).toBe(2);
    expect(config.allowedOrigins).toEqual(['https://a.test', 'https://b.test']);
    expect(config.turnUrls).toHaveLength(2);
  });

  it('treats empty strings as unset', () => {
    expect(loadConfig({ PORT: '', TURN_URLS: '' }).port).toBe(3000);
  });

  it('accepts a valid production configuration', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://a.test',
      TURN_SECRET: 'secret',
      TRUST_PROXY: '1',
    });
    expect(config.nodeEnv).toBe('production');
    expect(config.trustProxy).toBe(1);
  });

  it.each([
    [{ PORT: 'abc' }, 'PORT'],
    [{ MAX_ROOMS: '0' }, 'MAX_ROOMS'],
    [{ NODE_ENV: 'staging' }, 'NODE_ENV'],
    [{ TURN_URLS: 'turn:a.test:3478' }, 'TURN_SECRET: is required when TURN_URLS is set'],
    [{ NODE_ENV: 'production', TURN_SECRET: 's' }, 'ALLOWED_ORIGINS: is required in production'],
    [
      { NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://a.test' },
      'TURN_SECRET: is required in production',
    ],
  ])('rejects %p', (env, message) => {
    expect(() => loadConfig(env)).toThrow(message);
  });
});
