import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiTarget = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget },
      '/socket.io': { target: apiTarget, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
