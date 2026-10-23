const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

export const LOCAL_API_PORT = 3100;
export const LOCAL_WEB_PORT = 5273;

export const EXTERNAL_BASE_URL = env.E2E_BASE_URL?.replace(/\/$/, '');
export const BASE_URL = EXTERNAL_BASE_URL ?? `http://localhost:${LOCAL_WEB_PORT}`;
