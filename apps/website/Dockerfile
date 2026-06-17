# --- Build Stage ---
FROM oven/bun:1 AS build

WORKDIR /app

# Root workspace files
COPY package.json bun.lock ./
COPY apps/website/package.json ./apps/website/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

# Copy source
COPY apps/website ./apps/website
COPY packages/shared ./packages/shared

RUN cd apps/website && bun run build

# --- Production Stage ---
FROM oven/bun:1-slim AS production

WORKDIR /app

COPY --from=build /app/apps/website/dist ./dist
COPY --from=build /app/apps/website/package.json ./
COPY --from=build /app/bun.lock ./

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["bun", "dist/server/index.mjs"]
