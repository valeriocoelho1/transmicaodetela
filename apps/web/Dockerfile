# Build context: repository root (docker compose sets context: .)
FROM node:24-alpine AS build
WORKDIR /repo
RUN npm install -g pnpm@12.15.0
COPY . .
RUN pnpm install --frozen-lockfile --filter "@app/web..."
RUN pnpm --filter @app/shared build && pnpm --filter @app/web build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
