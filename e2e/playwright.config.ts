import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3100;
const WEB_PORT = 5273;

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'pnpm --filter @app/shared build && pnpm --filter @app/api build && node apps/api/dist/main.js',
      cwd: '..',
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        MAX_VIEWERS_PER_ROOM: '2',
        ALLOWED_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @app/web exec vite',
      cwd: '..',
      url: `http://localhost:${WEB_PORT}`,
      env: { WEB_PORT: String(WEB_PORT), API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
