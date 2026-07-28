# CLAUDE.md

Leitfaden für Claude Code (und andere Agents) in diesem Repository. Diese Datei wird bei jeder Session automatisch eingelesen.

## Projekt

**Old Nerds Playing Older Games (ONOG)** — Website, API, Discord-Bot und geteilte Types für das Retro-Gaming-Projekt gleichen Namens. Kernfeature ist die Organisation von "Gamedays": Spieler-Pairings, Matchups, Vetos und Map-Reihenfolge, angestoßen per Discord-Slash-Command und ausgespielt im Web.

## Tech-Stack & Tooling

- **Monorepo:** Bun Workspaces (`apps/*`, `packages/*`) + [Turborepo](https://turborepo.dev)
- **Package Manager:** `bun@1.3.14` — **immer `bun` / `bunx`**, nicht npm/pnpm/yarn
- **Sprache:** TypeScript (ESM, `"type": "module"` überall)
- **Formatierung:** Prettier (`.prettierrc`) — **Tabs**, keine Spaces
- **Linting:** ESLint Flat Config (`eslint.config.ts`); aktuell nur `apps/website` hat einen echten Lint-Step

## Struktur

```
apps/
  website/   @onog/website  — Frontend (TanStack Start, React 19)
  api/       @onog/api      — Backend (Hono + SurrealDB)
  bot/       @onog/bot      — Discord Interactions Webhook (Hono)
packages/
  shared/    @onog/shared   — geteilte TS-Types + Logger (als Source konsumiert, kein Build)
```

### apps/website (`@onog/website`) — Port 3000
- **Framework:** TanStack Start / TanStack Router (dateibasiert, `src/routes/`), React 19, Vite 8
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`)
- Routes: `index`, `pairing`, `matchup`, `veto`, `map-order`, `health`, `gameday.$id` (Live-Ansicht); API-Proxy unter `src/routes/api/$.ts`
- Auth im Frontend: `src/lib/auth.ts`, `LoginButton.tsx`, `UserMenu.tsx` (Discord Login)
- **Typed API-Client:** `src/lib/api.ts` — Hono-RPC `hc<AppType>` (`AppType` aus `apps/api/src/index.ts`, via **type-only** devDependency `@onog/api` → beim Build vollständig erased, nichts vom Server im Bundle). Requests laufen same-origin über den `/api`-Proxy mit `credentials: 'include'`. Ersetzt handgeschriebene `fetch`-Aufrufe an die API.
- **Live-Updates:** Hook `src/lib/useGamedayEvents.ts` — öffnet eine `EventSource` auf `/api/gamedays/:id/events` und registriert je Handler-Key einen nativen SSE-Listener (`addEventListener(type)`), reconnected mit Backoff. Ersetzt Polling. Neuer Event-Typ = ein Handler-Key. Demo/Konsument: Route `gameday.$id.tsx` (Initial-Fetch, danach nur SSE-Updates).
- UI-Komponenten unter `src/components/` — siehe Skill `component-library` vor UI-Arbeit

### apps/api (`@onog/api`) — Port 4001
- **Framework:** Hono, **SurrealDB** (SDK 2.x), Zod für Env-Config (`src/config.ts`)
- **Auth:** Discord OAuth (`src/routes/auth.ts`), JWT im Cookie `onog_token` (HS256), JWT-Middleware schützt `/api/gamedays/*`
- **Datenzugriff:** Model-Pattern in `src/models/` (`Model<T>`-Interface in `models/types.ts`). Jedes Model hält sein SurrealDB-Schema als DDL-String; `initSchemas()` (`models/index.ts`) führt sie beim Start aus.
- DB-Connection: `src/db.ts` (Singleton, `ws://localhost:8000`, Namespace/DB `onog`)
- **Typed RPC:** `src/index.ts` exportiert `AppType = typeof app`; das Package exponiert `src/index.ts` als `types`/`exports`. Die Website leitet daraus ihren Client ab (`hc<AppType>`, type-only) — Voraussetzung: Routen bleiben **method-chained**, damit Hono die Typen inferiert.
- **Live-Updates (SSE):** Generischer Server-Sent-Events-Kanal pro Gameday. Trennung: **purer, transport-agnostischer** Pub/Sub-Hub in `src/lib/events.ts` (`subscribe`/`broadcast`, kennt keine Streams) vs. SSE-Lifecycle in `src/lib/sse.ts` (`openGamedayStream` — subscribe + Cleanup bei Abbruch; ein **geteilter** Heartbeat-Intervall für alle offenen Streams, lazy gestartet/gestoppt). Endpoint `GET /api/gamedays/:id/events` (`hono/streaming` → `streamSSE`) ist damit ein Einzeiler. Der Event-Typ steht im nativen SSE-`event:`-Feld, der Payload als JSON im `data:`-Feld — logisch das Envelope `GamedayEvent = { type, payload }`. Versenden von überall via `broadcast(id, { type, payload })`. `PUT /api/gamedays/:id` broadcastet `matchup-updated` + `standings-updated`. MVP: Single-Instance (kein instanzübergreifendes Fan-out).

### apps/bot (`@onog/bot`) — Port 4000
- **Framework:** Hono; verifiziert Discord-Signaturen mit `tweetnacl`
- Behandelt den `/gameday`-Slash-Command und verlinkt in die Website
- `bun run register-commands` registriert Slash-Commands bei Discord

### packages/shared (`@onog/shared`)
- Plain-TypeScript-Types (`GamedayData`, `Matchup`, `MatchupWithState`, `User`) + `logger`
- `MatchupWithState` trägt neben `active` das Matchup-Ergebnis: `winner?: MatchupSlot` (`'player1' | 'player2'`, offizielle Quelle der Wahrheit), optional `score`, optional `replayId`.
- SSE-Envelope: `GamedayEvent<T> = { type, payload }` mit `GamedayEventType` (`connected` | `standings-updated` | `matchup-updated` | `replay-status`) — additiv erweiterbar.
- **Kein** Build-Step, **keine** DB-Dependency — wird direkt als TS-Source importiert
- Wird von `api` und `website` via `workspace:*` konsumiert

## Service-Ports

| Service    | Port |
| :--------- | :--- |
| website    | 3000 |
| bot        | 4000 |
| api        | 4001 |
| SurrealDB  | 8000 |

Die API lief früher auf 5000 — das kollidiert unter macOS mit AirPlay, daher 4001.

## Befehle

Vom Repo-Root (laufen über Turborepo über alle Workspaces):

| Befehl            | Aktion                                   |
| :---------------- | :--------------------------------------- |
| `bun install`     | Dependencies installieren                |
| `bun run dev`     | Alle Dev-Server starten (`turbo run dev`)|
| `bun run build`   | Produktions-Build                        |
| `bun run lint`    | Lint über alle Workspaces                |

Pro App nutzt der Dev-Modus `bun run --hot src/index.ts` (api/bot) bzw. `vite dev` (website).

**Wichtig:** Der Nutzer startet und testet die Apps selbst. Starte keine Dev-Server oder Live-Services ungefragt und probe keine laufenden Dienste an.

## Datenmodell-Konsistenz

Die SurrealDB-Schemas in `apps/api/src/models/` sind die **Single Source of Truth** für die Datenstruktur. Das Frontend hat keine SurrealDB-Dependency und nutzt stattdessen die Plain-TS-Types aus `packages/shared/src/types.ts`.

**Nach jeder Schema-Änderung an einem Model müssen die entsprechenden Types in `packages/shared/` nachgezogen werden.** Details, Mapping-Regeln und Checkliste dazu liefert der Skill **`sync-schema-types`** (triggert automatisch bei Änderungen unter `apps/api/src/models/`).

## Git-Commits

Der Nutzer verwaltet Git-Commits **selbst** und möchte die volle Kontrolle über die Historie behalten.

- **Keine eigenmächtigen Commits:** Führe niemals `git commit` aus ohne explizite Anweisung.
- **Kein `git push`** ohne explizite Aufforderung.
- **Staging erlaubt:** `git add` darf genutzt werden, um Dateien zur Überprüfung vorzubereiten, wenn gewünscht.
- **Commits auf Anweisung:** Erlaubt, sobald der User explizit dazu auffordert ("Ja, committen", "Mach den Commit", "Commit so") — oder im Rahmen des `commit-message`-Skills. Nutze dann den Heredoc-Ansatz:
  ```bash
  git commit -F - << 'EOF'
  <subject>

  <body>
  EOF
  ```
- **Commit-Vorschläge im Fließtext:** Ist ein sinnvoller Commit-Punkt erreicht, darf ein Hinweis im Fließtext gegeben werden (kein automatischer Commit), z.B. _"Die Änderungen sind vollständig. Du könntest jetzt mit `fix: ...` committen."_

Das Projekt nutzt **Conventional Commits** (siehe Historie: `feat:`, `chore(release):` …).

## Skills

Projekt-Skills unter `.claude/skills/` — werden bei passendem Trigger automatisch aktiv:

- **`commit-message`** — generiert eine Conventional-Commits-Message aus Diff + Gesprächsverlauf
- **`create-issue`** — legt Epic/Story/Tech-Issues via `gh` an
- **`feature-discovery`** — erarbeitet ein neues Feature-Konzept mit dem User
- **`component-library`** — Design-Regeln für die ONOG-Komponenten (vor UI-Arbeit lesen)
- **`sync-schema-types`** — hält `packages/shared`-Types mit den API-Models synchron
