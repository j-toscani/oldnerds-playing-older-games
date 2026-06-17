# syntax=docker/dockerfile:1
#
# Gemeinsame Dockerfile für alle Apps im Monorepo.
#
# Build-Argumente (alle Pflichtfelder außer BUILD_OUTPUT):
#   TURBO_PACKAGE  – Turborepo-Paketname,    z.B. "@ong/api"
#   APP_DIR        – Verzeichnis der App,     z.B. "apps/api"
#   PORT           – Lausch-Port des Servers, z.B. "5000"
#   ENTRYPOINT     – Einstiegspunkt nach dem Build, z.B. "dist/index.js"
#   BUILD_OUTPUT   – Build-Ausgabeordner (Standard: "dist"), z.B. ".output" für die Website
#
# Beispiel:
#   docker build \
#     --build-arg TURBO_PACKAGE=@ong/api \
#     --build-arg APP_DIR=apps/api \
#     --build-arg PORT=5000 \
#     --build-arg ENTRYPOINT=dist/index.js \
#     -f Dockerfile .

# ─────────────────────────────────────────────
# Stage 1: pruner
#   turbo prune erzeugt ein geschnittenes Sub-Repo in /app/out/:
#     out/json/   → nur die nötigen package.json-Dateien
#     out/full/   → nur der nötige Quellcode
#     out/bun.lock → geprunte Lockfile (nur relevante Dependencies)
# ─────────────────────────────────────────────
FROM oven/bun:1 AS pruner

WORKDIR /app

ARG TURBO_PACKAGE
ENV TURBO_PACKAGE=${TURBO_PACKAGE}

COPY . .

RUN bunx turbo prune ${TURBO_PACKAGE} --docker

# ─────────────────────────────────────────────
# Stage 2: installer
#   Installiert NUR die Dependencies des Ziel-Pakets.
#   Dieser Layer wird gecacht, solange sich keine package.json
#   oder die Lockfile ändert.
# ─────────────────────────────────────────────
FROM oven/bun:1 AS installer

WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN bun install --frozen-lockfile

# ─────────────────────────────────────────────
# Stage 3: builder
#   Baut das Ziel-Paket mit Bun's nativem --filter Flag.
# ─────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

ARG TURBO_PACKAGE

COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .

RUN bun run --filter ${TURBO_PACKAGE} build

# ─────────────────────────────────────────────
# Stage 4: runner
#   Minimales Produktions-Image – nur das Build-Artefakt.
# ─────────────────────────────────────────────
FROM oven/bun:1-slim AS runner

WORKDIR /app

ARG APP_DIR
ARG PORT=3000
ARG BUILD_OUTPUT=dist
ARG ENTRYPOINT

ENV NODE_ENV=production
ENV PORT=${PORT}
ENV ENTRYPOINT_PATH="${APP_DIR}/${BUILD_OUTPUT}"
ENV ENTRYPOINT_FILE=${ENTRYPOINT}

EXPOSE ${PORT}

COPY --from=builder /app/${APP_DIR}/${BUILD_OUTPUT} ./${BUILD_OUTPUT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:${PORT}/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD bun ${ENTRYPOINT_FILE}
