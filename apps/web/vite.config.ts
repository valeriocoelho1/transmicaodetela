import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const API_START_WAIT_MS = 60_000;
const API_POLL_MS = 500;

async function apiIsUp(apiTarget: string): Promise<boolean> {
  try {
    return (await fetch(`${apiTarget}/api/health`)).ok;
  } catch {
    return false;
  }
}

// In dev the API (nest --watch) can take a while to start or restart. Hold proxied requests until
// it answers instead of failing them with ECONNREFUSED.
function waitForApi(apiTarget: string): Plugin {
  return {
    name: 'wait-for-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url?.startsWith('/api/') && !req.url?.startsWith('/socket.io/')) return next();
        void (async () => {
          const deadline = Date.now() + API_START_WAIT_MS;
          let warned = false;
          while (!(await apiIsUp(apiTarget)) && Date.now() < deadline) {
            if (!warned) {
              server.config.logger.info(`Waiting for the API at ${apiTarget}…`, {
                timestamp: true,
              });
              warned = true;
            }
            await new Promise((resolve) => setTimeout(resolve, API_POLL_MS));
          }
          next();
        })();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['WEB_PORT', 'API_PORT']);
  const webPort = Number(env.WEB_PORT ?? 5173);
  const apiTarget = `http://localhost:${env.API_PORT ?? 3000}`;

  return {
    plugins: [react(), waitForApi(apiTarget)],
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget },
        '/socket.io': { target: apiTarget, ws: true },
      },
    },
    test: {
      environment: 'node',
    },
  };
});
