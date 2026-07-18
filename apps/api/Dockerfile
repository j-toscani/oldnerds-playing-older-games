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
ENV PORT=4001
EXPOSE 4001

# Persistenz-Verzeichnis für SurrealDB (falls embedded in Zukunft)
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:4001/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["bun", "dist/index.js"]
