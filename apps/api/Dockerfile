# --- Build Stage ---
FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN cd apps/api && bun run build

# --- Production Stage ---
FROM oven/bun:1-slim AS production

WORKDIR /app

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Persistenz-Verzeichnis für SurrealDB (falls embedded in Zukunft)
VOLUME ["/app/data"]

CMD ["bun", "dist/index.js"]
