# --- Build Stage ---
FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- Production Stage ---
FROM oven/bun:1-slim AS production

WORKDIR /app

COPY --from=build /app/.output .output

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
