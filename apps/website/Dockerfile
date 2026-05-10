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

COPY --from=build /app/apps/website/.output .output
COPY --from=build /app/apps/website/package.json ./
COPY --from=build /app/bun.lock ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
