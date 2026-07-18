---
name: sync-schema-types
description: Hält die Plain-TS-Types in packages/shared/src/types.ts mit den SurrealDB-Models in apps/api/src/models/ synchron. Trigger beim Erstellen oder Ändern von Dateien unter apps/api/src/models/ (neue Felder, geänderte Typen, neue Models) oder wenn nach einer Schema-Änderung die Shared-Types abweichen.
---

# Skill: Schema ↔ Shared Types Sync

## Trigger

Aktiv werden, sobald Dateien unter `apps/api/src/models/` erstellt oder geändert werden — insbesondere:

- ein neues Model wird angelegt,
- Felder im `schema`-DDL-String eines Models werden hinzugefügt/entfernt/umbenannt,
- ein Feldtyp ändert sich (z.B. `option<...>`, neue Objekt-Struktur).

## Regel

Die SurrealDB-Schemas in `apps/api/src/models/` sind die **Single Source of Truth** für die
Datenstruktur. Das Frontend hat **keine SurrealDB-Dependency** und nutzt stattdessen die
Plain-TypeScript-Types aus `packages/shared/`.

**Nach jeder Schema-Änderung** müssen die entsprechenden Types in
`packages/shared/src/types.ts` aktualisiert werden, sodass sie die gleiche Struktur abbilden
wie die `DEFINE FIELD`-Definitionen des Models.

## Kontext des aktuellen Codes

- Jedes Model (z.B. `apps/api/src/models/gameday.ts`) definiert sein Schema als
  **SurrealDB-DDL-String** (`DEFINE TABLE ... SCHEMAFULL; DEFINE FIELD ...`), nicht via Surqlize.
- Das Model mappt zwischen dem DB-`Record` und dem Shared-Type (`toResponse` / `toContent`).
- Der Shared-Type wird von `api` und `website` über `@onog/shared` konsumiert und muss in
  `packages/shared/src/index.ts` exportiert sein (Types werden via `export type * from './types'`
  automatisch mitexportiert).

## Mapping DDL → Shared Type

| SurrealDB `DEFINE FIELD` Typ          | Shared TS-Type                              |
| :------------------------------------ | :------------------------------------------ |
| `TYPE string`                         | `string`                                    |
| `TYPE bool`                           | `boolean`                                   |
| `TYPE int` / `TYPE number`            | `number`                                    |
| `TYPE datetime`                       | `Date` (bzw. `string` im Response-Mapping)  |
| `TYPE array<string>`                  | `string[]`                                  |
| `TYPE option<array<object>>` + Felder | eigener Type als `Type[] \| null`           |
| `TYPE object` mit `feld[*].x`         | eigener benannter Type (z.B. `MatchupWithState`) |

Wichtig: `option<...>` erlaubt, dass das Feld fehlt (SurrealDB `NONE`). Im Shared-Type wird das
als `... | null` abgebildet; das Model normalisiert `NONE`/`undefined` zu `null`
(siehe `toResponse` in `gameday.ts`).

## Beispiel

Model (`apps/api/src/models/gameday.ts`):
```typescript
DEFINE TABLE OVERWRITE gameday SCHEMAFULL;
DEFINE FIELD OVERWRITE players             ON TABLE gameday TYPE array<string>;
DEFINE FIELD OVERWRITE matchups            ON TABLE gameday TYPE option<array<object>>;
DEFINE FIELD OVERWRITE matchups[*].player1 ON TABLE gameday TYPE string;
DEFINE FIELD OVERWRITE matchups[*].player2 ON TABLE gameday TYPE string;
DEFINE FIELD OVERWRITE matchups[*].active  ON TABLE gameday TYPE bool;
DEFINE FIELD OVERWRITE noBackToBack        ON TABLE gameday TYPE bool DEFAULT true;
```

Resultierender Shared-Type (`packages/shared/src/types.ts`):
```typescript
export type Matchup = { player1: string; player2: string };
export type MatchupWithState = Matchup & { active: boolean };
export type GamedayData = {
	id?: string;
	players: string[];
	matchups: MatchupWithState[] | null;
	noBackToBack: boolean;
};
```

## Checkliste

- [ ] Alle Felder aus dem Model-Schema sind im Shared-Type abgebildet
- [ ] `option<...>` → `... | null` im Shared-Type
- [ ] `array<...>` → `...[]`
- [ ] verschachteltes `object` / `feld[*].x` → eigener benannter Type (wenn sinnvoll)
- [ ] `id` ist im Shared-Type als `id?: string` (optional, beim Create noch nicht vorhanden)
- [ ] interne DB-Felder (z.B. `createdAt`) nur aufnehmen, wenn sie Teil des Response-Contracts sind
- [ ] neuer Type wird über `packages/shared/src/index.ts` exportiert
- [ ] das Model-Mapping (`toResponse` / `toContent`) passt weiterhin zum Shared-Type
