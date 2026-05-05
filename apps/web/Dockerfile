# --- Build Stage ---
FROM oven/bun:1 AS build

WORKDIR /app

# Root workspace files
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

# Copy source
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

RUN cd apps/web && bun run build

# --- Production Stage ---
FROM oven/bun:1-slim AS production

WORKDIR /app

COPY --from=build /app/apps/web/.output .output
COPY --from=build /app/apps/web/package.json ./
COPY --from=build /app/bun.lock ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
