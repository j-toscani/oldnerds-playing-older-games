# Tech note: adding a model to the API

How a SurrealDB-backed model is built in `apps/api`. There is currently no model; the last one
(`gameday`) was removed because the website keeps gameday state in `localStorage`. Its full
source is the reference implementation:

```bash
git show aa9a092:apps/api/src/models/gameday.ts
```

## What already exists

- `src/db.ts`: `getDb()` returns the connected `Surreal` singleton (namespace/database from
  `SURREAL_*` in `src/config.ts`).
- `src/models/types.ts`: the `Model<T>` interface every model implements.
- `src/models/index.ts`: the `models` list and `initSchemas()`, which runs each model's schema on
  startup.

## Steps

1. Create `src/models/<name>.ts` exporting an object that implements `Model<T>` (`schema`,
   `create`, `findById`, `find`, `remove`). Extra methods go into an extended interface, e.g.
   `interface GamedayModel extends Model<...> { update(...) }`.
2. Put the schema as a DDL string into `schema`. Use `OVERWRITE` on every statement, because it
   runs again on every start:

   ```sql
   DEFINE TABLE OVERWRITE gameday SCHEMAFULL;
   DEFINE FIELD OVERWRITE players             ON TABLE gameday TYPE array<string>;
   DEFINE FIELD OVERWRITE matchups            ON TABLE gameday TYPE option<array<object>>;
   DEFINE FIELD OVERWRITE matchups[*].player1 ON TABLE gameday TYPE string;
   DEFINE FIELD OVERWRITE createdAt           ON TABLE gameday TYPE datetime DEFAULT time::now();
   ```

3. Keep two types apart: a `<Name>Record` as SurrealDB returns it (`id: RecordId`,
   `createdAt: Date`) and the plain shared type the API responds with. Map between them:
   - `toResponse(record)`: `record.id.id as string`; normalize optional fields from
     `undefined` (SurrealDB `NONE`) to `null`.
   - `toContent(data)`: drop `null`/`undefined` values of `option<...>` fields before writing.
4. Access data only through `getDb()`, with `new Table('<name>')` for the whole table and
   `new RecordId('<name>', id)` for a single record. `create` with a `Table` returns an array.
5. Register the model in the `models` list in `src/models/index.ts`.
6. Mirror the schema in `packages/shared/src/types.ts` (skill `sync-schema-types`). The website
   only ever sees these plain types; it has no SurrealDB dependency.
7. Expose it through a method-chained Hono route with explicit status codes in `c.json()`, so
   the website's typed client (`hc<AppType>`) picks it up. Validate request bodies with zod.

## SurrealDB gotchas

- **`option<...>` rejects `null`.** A JS `null` maps to SurrealDB `NULL`, which a `SCHEMAFULL`
  `option<...>` field refuses. Omit the key so it is stored as `NONE` (hence `toContent`).
- **Nested objects need field definitions.** An `array<object>` field rejects its objects unless
  each nested field is defined (`matchups[*].player1`, ...).
- **SDK 2.x vs server 3.x.** The API uses the `surrealdb` SDK 2.0.x; the devcontainer runs
  server 3.x. `db.health()` fails there (`-32601 Method not found`); use `db.ready` or a trivial
  query. Queries, select, create, update and delete work.
- **Lookups by a malformed id throw.** `findById`/`update` catch and return `null`, so the route
  can answer `404`.
