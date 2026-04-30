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

COPY --from=build /app/dist dist

RUN bun add -g srvx

ENV NODE_ENV=production
EXPOSE 3000

CMD ["srvx", "--prod", "-s", "../client", "dist/server/server.js"]
