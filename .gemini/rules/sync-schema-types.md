# Schema ↔ Shared Types Sync

## Trigger

Wenn Dateien unter `apps/api/src/schema/` erstellt oder geändert werden.

## Regel

Die Surqlize-Schemas in `apps/api/src/schema/` sind die **Single Source of Truth** für die Datenstruktur. Das Frontend hat **keine Surqlize-Dependency** und nutzt stattdessen plain TypeScript-Types aus `packages/shared/`.

**Nach jeder Schema-Änderung** müssen die entsprechenden Types in `packages/shared/src/types.ts` aktualisiert werden, sodass sie die gleiche Struktur abbilden wie die Surqlize-Definition.

### Beispiel

Schema (`apps/api/src/schema/gameday.ts`):
```typescript
export const gameday = table('gameday', {
  players: t.array(t.string()),
  matchups: t.option(t.array(t.object({
    player1: t.string(),
    player2: t.string(),
    active: t.bool(),
  }))),
  noBackToBack: t.bool(),
});
```

Daraus resultierende Shared Types (`packages/shared/src/types.ts`):
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

### Checkliste

- [ ] Alle Felder aus dem Surqlize-Schema sind im Shared Type abgebildet
- [ ] `t.option(...)` → `... | null` im Shared Type
- [ ] `t.array(...)` → `...[]` im Shared Type
- [ ] `t.object({...})` → eigener benannter Type wenn sinnvoll (z.B. `MatchupWithState`)
- [ ] `id` ist im Shared Type als `id?: string` (optional, da beim Create noch nicht vorhanden)
- [ ] `packages/shared/src/index.ts` exportiert den neuen Type
