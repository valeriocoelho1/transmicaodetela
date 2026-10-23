import { defineConfig, devices } from '@playwright/test';
import { EXTERNAL_BASE_URL, LOCAL_API_PORT, LOCAL_WEB_PORT } from './support/target';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: Boolean(EXTERNAL_BASE_URL),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: EXTERNAL_BASE_URL
    ? undefined
    : [
        {
          command:
            'pnpm --filter @app/shared build && pnpm --filter @app/api build && node apps/api/dist/main.js',
          cwd: '..',
          url: `http://localhost:${LOCAL_API_PORT}/api/health`,
          env: {
            NODE_ENV: 'test',
            PORT: String(LOCAL_API_PORT),
            MAX_VIEWERS_PER_ROOM: '2',
            ALLOWED_ORIGINS: `http://localhost:${LOCAL_WEB_PORT}`,
          },
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @app/web exec vite',
          cwd: '..',
          url: `http://localhost:${LOCAL_WEB_PORT}`,
          env: { WEB_PORT: String(LOCAL_WEB_PORT), API_PORT: String(LOCAL_API_PORT) },
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
});
