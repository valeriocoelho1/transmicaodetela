# Build context: repository root (docker compose sets context: .)
FROM node:24-alpine AS build
WORKDIR /repo
RUN npm install -g pnpm@12.15.0
COPY . .
RUN pnpm install --frozen-lockfile --filter "@app/api..."
RUN pnpm --filter @app/shared build && pnpm --filter @app/api build
RUN pnpm --filter @app/api deploy --prod /out

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
