import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');
export const CLOCK = Symbol('CLOCK');

export type Clock = () => number;

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const list = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65535).default(3000),
    ALLOWED_ORIGINS: list.default(['http://localhost:5173']),
    TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
    MAX_VIEWERS_PER_ROOM: positiveInt(10),
    MAX_ROOMS: positiveInt(50),
    ROOM_HOST_GRACE_MS: positiveInt(60_000),
    VIEWER_GRACE_MS: positiveInt(20_000),
    ROOM_UNUSED_TTL_MS: positiveInt(900_000),
    ROOM_MAX_AGE_MS: positiveInt(43_200_000),
    SWEEP_INTERVAL_MS: positiveInt(30_000),
    STUN_URLS: list.default(['stun:stun.l.google.com:19302']),
    TURN_URLS: list.default([]),
    TURN_SECRET: z.string().optional(),
    TURN_CREDENTIAL_TTL_SECONDS: positiveInt(43_200),
    SOCKET_RATE_LIMIT_EVENTS: positiveInt(300),
    SOCKET_RATE_LIMIT_WINDOW_MS: positiveInt(10_000),
    MAX_SOCKETS_PER_IP: positiveInt(20),
  })
  .superRefine((env, ctx) => {
    if (env.ALLOWED_ORIGINS.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'must not be empty' });
    }
    if (env.TURN_URLS.length > 0 && !env.TURN_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['TURN_SECRET'],
        message: 'is required when TURN_URLS is set',
      });
    }
    if (env.NODE_ENV === 'production' && !env.TURN_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['TURN_SECRET'], message: 'is required in production' });
    }
  });

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  allowedOrigins: string[];
  trustProxy: number;
  maxViewersPerRoom: number;
  maxRooms: number;
  roomHostGraceMs: number;
  viewerGraceMs: number;
  roomUnusedTtlMs: number;
  roomMaxAgeMs: number;
  sweepIntervalMs: number;
  stunUrls: string[];
  turnUrls: string[];
  turnSecret: string | undefined;
  turnCredentialTtlSeconds: number;
  socketRateLimitEvents: number;
  socketRateLimitWindowMs: number;
  maxSocketsPerIp: number;
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const present = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  const issues: string[] = [];
  if (present.NODE_ENV === 'production' && present.ALLOWED_ORIGINS === undefined) {
    issues.push('ALLOWED_ORIGINS: is required in production');
  }
  const parsed = envSchema.safeParse(present);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }
  if (issues.length > 0 || !parsed.success) {
    throw new Error(`Invalid configuration:\n- ${issues.join('\n- ')}`);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    allowedOrigins: e.ALLOWED_ORIGINS,
    trustProxy: e.TRUST_PROXY,
    maxViewersPerRoom: e.MAX_VIEWERS_PER_ROOM,
    maxRooms: e.MAX_ROOMS,
    roomHostGraceMs: e.ROOM_HOST_GRACE_MS,
    viewerGraceMs: e.VIEWER_GRACE_MS,
    roomUnusedTtlMs: e.ROOM_UNUSED_TTL_MS,
    roomMaxAgeMs: e.ROOM_MAX_AGE_MS,
    sweepIntervalMs: e.SWEEP_INTERVAL_MS,
    stunUrls: e.STUN_URLS,
    turnUrls: e.TURN_URLS,
    turnSecret: e.TURN_SECRET,
    turnCredentialTtlSeconds: e.TURN_CREDENTIAL_TTL_SECONDS,
    socketRateLimitEvents: e.SOCKET_RATE_LIMIT_EVENTS,
    socketRateLimitWindowMs: e.SOCKET_RATE_LIMIT_WINDOW_MS,
    maxSocketsPerIp: e.MAX_SOCKETS_PER_IP,
  };
}
