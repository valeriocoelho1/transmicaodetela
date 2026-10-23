import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['WEB_PORT', 'API_PORT']);
  const webPort = Number(env.WEB_PORT ?? 5173);
  const apiTarget = `http://localhost:${env.API_PORT ?? 3000}`;

  return {
    plugins: [react()],
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget },
        '/socket.io': { target: apiTarget, ws: true },
      },
    },
    test: {
      environment: 'jsdom',
    },
  };
});
