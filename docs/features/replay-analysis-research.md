# Research: replay analysis (build-order timeline + economy/production analyses)

Status: research only, 2026-10-24. Nothing implemented yet. Basis for a later feature concept
(`feature-discovery`) and epic.

Findings were verified by parsing `packages/replay-parser/tests/fixtures/Burrow.SC2Replay` with
the checked-in WASM package (`pkg/`) under Bun (Zerg vs. Protoss AI, build 92440).

Conventions: `loop` = absolute game loop (sum of the events' `delta`s). Real time at game speed
"Faster" (ladder default, LotV in-game clock) = `loop / 22.4` seconds. 16 loops = 1 "Blizzard second".

## Goal

Users analyse their uploaded replays. First increment: a timeline of what was built when.
Later questions:

1. When did I reach X supply?
2. How long was building Y idle?
3. How did my income change over time?
4. How did my bank change over time?
5. Which units did I have at which time?
6. How many resources are tied up in production queues?

---

## 1. Data sources

### What the parser delivers today

- `packages/replay-parser/src/lib.rs:173-176` reads **only** `details` and **tracker events**.
  No game events, no message events, no init data.
- The tracker events are passed through **raw** (s2protocol's serde serialization) into
  `ParsedReplay.trackerEvents: unknown[]` (`packages/shared/src/types.ts`). They are therefore
  **already stored in IndexedDB** for every imported replay.
- Tracker event types (s2protocol `src/tracker_events/mod.rs`): `PlayerStats`, `UnitBorn`,
  `UnitDied`, `UnitOwnerChange`, `UnitTypeChange`, `Upgrade`, `UnitInit`, `UnitDone`,
  `UnitPosition`, `PlayerSetup`.
- Serialized shape (verified):
  `{ delta, event: { UnitBorn: { unit_tag_index, unit_tag_recycle, unit_type_name, control_player_id, upkeep_player_id, x, y, creator_unit_tag_index?, creator_unit_tag_recycle?, creator_ability_name? } } }`.
  Keys are **snake_case**; unit names are **already resolved strings** (`"Pylon"`, `"Stalker"`),
  so no balance-data registry is needed for names.

### Verified semantics

| Observation | Evidence (fixture) |
| :--- | :--- |
| `PlayerStats` per player at loop 1, then every **160 loops** (10 Blizzard s = **7.14 s real time**) | loops `[1, 160, 320, 480, …]` |
| `UnitInit` = structure start (and **warp-ins**), `UnitDone` = completion | Pylon 445→845 = 400 loops = 17.9 s (expected 18 s); Gateway 46.4 s (46 s); Hatchery 71.4 s (71 s) |
| `UnitBorn` with `creator_unit_tag_*` + `creator_ability_name` identifies the **producing structure** (Terran/Protoss) | `Probe` creator=Nexus abil=`NexusTrain`, `GatewayTrain`, `RoboticsFacilityTrain`, `TrainQueen` |
| `UnitBorn` fires only on **completion**; the production start of T/P units is not in the tracker | — |
| Zerg: `UnitTypeChange Larva→Egg` = **exact start**, `UnitBorn … creator=Egg abil=LarvaTrain` = end | Egg at 13, Drone born at 285 = 12.1 s (12 s) |
| Warp-ins: `UnitInit`/`UnitDone` **without** creator → not attributable to a WarpGate | `UnitInit` has no creator fields (s2protocol `tracker_events/unit_init.rs`) |
| Morphs (Hatchery→Lair, Gateway→WarpGate, burrow variants) are `UnitTypeChange`; structure morphs appear only on **completion** | burrow toggles produce a lot of noise |
| `Upgrade` only on **completion**, no structure reference; includes cosmetic entries | `SprayZerg`, `RewardDance*` must be filtered |
| A Zerg drone "dies" only when its structure **completes** | Hatchery `UnitDone` 2687 = Drone died 2687 |
| Larva spawn and inject are both `UnitBorn Larva creator=Hatchery abil=""`; inject only distinguishable by timing pattern | bursts at 4406/4410/4414 |
| Neutral/map objects (`MineralField*`, `Beacon*`, `XelNagaTower`, rocks) have `control_player_id: 0` | must be filtered |
| Volume: fixture 1,000 tracker events / 261 KB JSON; real 1v1s 488–1,974 events (`replay-library-local.md`) | full parse incl. tracker events: 23 ms under Bun |

### `PlayerStats` fields

`minerals_current`, `vespene_current` (bank), `minerals_collection_rate`,
`vespene_collection_rate` (income per minute), `workers_active_count`,
`{minerals,vespene}_used_in_progress_{army,economy,technology}` (tied up in production),
`*_used_current_*`, `*_lost_*`, `*_killed_*`, `food_used`, `food_made`,
`{minerals,vespene}_used_active_forces` (army value), friendly fire.

**Supply precision:** s2protocol `versions/protocol87702/events/tracker/mod.rs:224-226` computes
`food_used = m_score_value_food_used / 4096` as an **integer division**, so half supply
(zerglings) is truncated. Fixable in our fork (pass the raw value or a float).

### Suspected bug: `durationSeconds` is ~1.53× too high

- `lib.rs:181-182` uses s2protocol's `convert_tracker_loop_to_seconds`, which computes with
  **68.58 ms per loop** (≈ 14.58 loops/s; the crate comment says "observed in a game …"). That
  matches no SC2 game speed; Faster is 22.4 loops/s.
- Fixture: 8,474 loops → parser reports **581 s (9:41)**, `8474 / 22.4` = **378 s (6:18)**. The
  build times above (Pylon 400 loops = 18 s) clearly confirm 22.4 loops/s.
- `replay-library-local.md` states the durations of real replays were read correctly.
  **To verify** against the in-game display of a replay with a known length.
- `Details.game_speed` exists in s2protocol but is not read. Non-Faster games (custom/AI) need a
  different factor.

### Parser extensions

| Extension | Benefit | Effort / risk |
| :--- | :--- | :--- |
| `playerId` (tracker `player_id`) per parsed player | Reliable tracker ↔ details player mapping. Today `lib.rs:185-200` filters out observers, so an index-based mapping (`index + 1`) can shift with observer slots. `PlayerSetup` events + `working_set_slot_id` allow a robust mapping. | small |
| `food_*` without integer truncation | exact half supply | small (fork patch) |
| `gameSpeed` + correct duration | correct time axis and duration | small |
| **Game events** | exact production start (train commands), chrono boost, research start, cancels, APM | **large**: ability names stay empty without s2protocol's `included_assets` feature, which does not build for wasm32. Only `abil_link` + `abil_cmd_index` would be available, which change per build → mapping table per build needed (see `sc2-balance-data-registry.md`). Also needs selection-state tracking to know *which* unit executes a command, and commands are inputs, not outcomes. Much more data and parse time → then #70 (web worker) becomes relevant. |

---

## 2. Feasibility

| Question | Verdict | Source | Precision / caveats |
| :--- | :--- | :--- | :--- |
| **Build-order timeline** | **Exact** for structure start/end, Zerg unit start/end, warp-ins, upgrade and morph completion. **Approximate** for T/P unit start | `UnitInit`/`UnitDone`, `UnitBorn` (+ creator), `UnitTypeChange`, `Upgrade` | T/P start = `born − build time` (build-time table needed; chrono makes the start appear too early). Research and morph starts unknown → only "done at". Filters needed: neutral units, sprays/rewards, burrow toggles, larvae/eggs. Supply column only from the nearest `PlayerStats` sample (±7 s) or an own supply reconstruction |
| **1. When X supply?** | **Approximate**, good | `PlayerStats.food_used` | First sample ≥ X → 7.14 s window. Truncation for zerglings. Refinement: reconstruct supply from unit events and calibrate at the samples → ~1–2 s; needs a supply-cost table |
| **2. Building idle time** | **Estimate only**; different definition for Zerg | `UnitBorn.creator_unit_tag` + build-time table; structure lifetime from `UnitDone`/`UnitDied` | Busy interval = `[born − build time, born]` per creator. Error sources: chrono, reactor (two slots, creator is the Barracks), research (occupies the structure but has no structure reference), invisible cancels, morphs (CC→Orbital). WarpGates: no creator → only aggregated. Zerg: hatchery idle is meaningless → "unused larvae over time" (exact) and inject gaps (heuristic). Exact only with game events |
| **3. Income over time** | **Exact at samples** | `*_collection_rate`, `workers_active_count` | every 7.14 s; engine estimate (like the observer income tab) |
| **4. Bank over time** | **Exact at samples** | `minerals_current`, `vespene_current` | unknown between samples; derivable: average bank, spending quotient |
| **5. Units at time t** | **Exact** | `UnitBorn`/`UnitInit`/`UnitDone`/`UnitDied`/`UnitTypeChange`/`UnitOwnerChange` | lifecycle per tag `(index, recycle)`. Normalize eggs/cocoons and burrowed variants; a drone counts until its structure completes; owner changes. Army value additionally from `*_used_active_forces` |
| **6. Resources in production** | **Exact at samples** | `{minerals,vespene}_used_in_progress_{army,economy,technology}` | 7.14 s grid. **To verify:** whether queue slots *behind* the active production are included (resources are deducted when queuing). Queue contents are invisible without game events |

---

## 3. UI concept

### Routes

- **`/analysis`** (exists, `apps/website/src/routes/analysis/index.tsx`): the map cell in
  `ReplayTable` becomes a **link** to the detail page.
- **`/analysis/$replayId`** (revived): existed in `0014f16` (#74) and was replaced by the JSON
  download in `3335f0f` (#80). Reuse its loading / not-found / error states ("replays only live
  in this browser").

### Detail page layout

1. **Header:** map, date, duration, result; players as `PlayerBadge` (`components/game-ui.tsx`,
   p1 blue / p2 gold).
2. **Player switch:** native radio group "Player A | Player B | Both" (both = overlay in charts,
   side by side in lists). Team games: choose one player.
3. **Shared time cursor:** one `cursorLoop` state for the whole page. Set by hover/click on any
   chart **and** by a native `<input type="range">` (keyboard accessible) with an `mm:ss`
   readout. All charts draw a vertical line; lists highlight the row at the cursor.
4. **Sections** (each with `SectionLabel`):
   - **Build order:** table time · supply · name · kind (structure/unit/upgrade/morph) · done at.
     Checkbox filters "hide workers", "structures/upgrades only". Estimated start times marked
     with "≈". Clicking a row sets the cursor.
   - **Economy:** line charts sharing the x axis: income (minerals/gas), bank (minerals/gas),
     workers. KPI row: average bank, spending quotient.
   - **Supply:** step line `food_used` + `food_made` (supply blocks hatched where used ≥ made);
     milestone list "30/50/100/150/200 supply reached at ≈ mm:ss" instead of a free input.
   - **Units at time:** table unit × count at `cursorLoop` (exact); optionally stacked army
     value over time.
   - **Production:** stacked area "resources tied up in production" (army/economy/tech). Later a
     swimlane/Gantt per production structure (busy bars, gaps = idle, labelled "estimated"); for
     Zerg "unused larvae".
5. **Layout:** `PageContainer` is `max-w-180` (720 px, `components/layout.tsx`), too narrow for
   charts. A wider container variant for the detail page only; charts stack on mobile.
6. **States:** loading (IndexedDB), not found, storage blocked, "parser version too old — please
   re-import for this analysis", replay without player data (empty charts with explanation).

### Charting

`apps/website/package.json` has **no** chart library. Options:

- **Own small SVG components** (line/step/area + cursor line): few chart types, full control over
  design tokens, no bundle growth; axes, ticks and tooltips are built by hand.
- **uPlot:** small, fast, built-in cursor sync between charts; imperative, needs a thin React
  wrapper. Check its current docs before use.
- Recharts/visx: comfortable but much heavier.

Recommendation: start with an own SVG line-chart component (2–3 chart types suffice); keep the
decision open in the feature concept.

---

## 4. Integration & architecture

### Where the derivation logic lives

**Plain TypeScript in the website**, working on the already stored `trackerEvents`:

- No Rust/WASM rebuilds while iterating on analyses; pure functions testable with `bun test`.
- Works immediately for **all already imported replays**, because the raw events are stored.
- Trivial compute (≤ 2,000 events, one pass) → **no web worker needed**. #70 only becomes
  relevant if game events are added.
- Rust only for the raw data itself: `playerId`, food precision, `gameSpeed`/duration, maybe
  game events later.

Proposed modules in `apps/website/src/lib/replay-analysis/`:

- `tracker-events.ts`: boundary narrowing `unknown[] → TrackerEvent[]` with absolute `loop`,
  filters (player 0, sprays/rewards/beacons).
- `time.ts`: `LOOPS_PER_SECOND = 22.4`, `loopToSeconds`, `formatGameTime`.
- `stats.ts`: `PlayerStats` series per player.
- `units.ts`: unit lifecycles + `unitCountsAt(loop)`.
- `build-order.ts`: build-order entries.
- `production.ts`: busy/idle estimate (later, needs the data table).
- `unit-data.ts`: small curated table `name → { minerals, vespene, supply, buildLoops, producer }`
  for the current ladder patch, flagged "approximate" when `gameVersion` differs.

### Derived data shape

```ts
type ReplayAnalysis = {
	endLoop: number;
	players: { playerId: number; name: string; race: string; team: number }[];
	stats: Record<number, StatsSample[]>; // per playerId, every 160 loops
	units: UnitLifecycle[];
	buildOrder: BuildOrderEntry[];
};

type StatsSample = {
	loop: number;
	minerals: number;
	vespene: number;
	mineralsRate: number;
	vespeneRate: number;
	workers: number;
	supplyUsed: number;
	supplyCap: number;
	inProgress: { minerals: number; vespene: number };
	armyValue: { minerals: number; vespene: number };
};

type UnitLifecycle = {
	tag: string; // `${index}:${recycle}`
	playerId: number;
	types: { loop: number; name: string }[]; // born/init + type changes
	startLoop: number; // init (structures/warp-ins), egg start (Zerg) or born
	doneLoop?: number;
	diedLoop?: number;
	creatorTag?: string;
	creatorAbility?: string;
};

type BuildOrderEntry = {
	playerId: number;
	kind: 'structure' | 'unit' | 'upgrade' | 'morph';
	name: string;
	startLoop?: number;
	startIsEstimate: boolean;
	doneLoop?: number;
	supplyAtStart?: number;
};
```

### Storage

- **No IndexedDB schema change** (`replay-db.ts`, `DB_VERSION = 1`): compute the analysis on
  demand from `trackerEvents` and memoize in memory. Cache in IndexedDB only if measured slow.
- **Re-parse problem:** raw files are not stored, and re-importing the same file is rejected as
  a duplicate via the `contentHash` unique index (`replay-db.ts`). Parser fixes (duration,
  `playerId`, food) therefore never reach existing entries. Proposal: on import, **replace** an
  entry whose stored `parserVersion` is older (keep its `id`) and show a hint on the detail page.
  The analysis code needs fallbacks for old entries (e.g. `playerId = index + 1` with a warning).

### Suggested increments

1. **[TECH] Time base:** verify the `durationSeconds` finding on a real replay; fix the parser
   (duration from `loops / 22.4` or `game_speed`), `playerId` per player, food without
   truncation; bump `parserVersion`. Plus the re-import path for older parser versions.
2. **[TECH] Typed tracker-event narrowing + time utils** (pure TS, tests with a fixture excerpt).
3. **[STORY] Detail page `/analysis/$replayId`** with header, player switch, link from the table.
4. **[STORY] Build-order timeline** (table, filters, "≈" marking).
5. **[STORY] Economy charts** (income, bank, workers) + shared time cursor; chart decision.
6. **[STORY] Supply chart + milestones** (question 1).
7. **[STORY] Units at time** (question 5).
8. **[STORY] Resources tied up in production** (question 6); verify queue semantics first.
9. **[TECH] Unit data table** (cost, supply, build time, producer) for the current patch.
10. **[STORY] Production idle (estimated):** T/P per structure, Zerg as larva analysis
    (question 2). Optionally refine supply afterwards.
11. **[SPIKE, optional] Game events:** size/parse time, `abil_link` mapping, chrono/cancels/
    research start; decide on the web worker (#70) only after that.

---

## 5. Open questions / risks

- **Duration bug:** is `durationSeconds` really ~1.53× too high? If so, existing library entries
  show a wrong duration and cannot be re-imported because of the duplicate check.
- **Player mapping** tracker `player_id` ↔ `players[]` with observers/AI/team games is
  error-prone without a `playerId` from the parser.
- **`used_in_progress` semantics** (are queue slots included?): verify on a replay with full queues.
- **Build times/costs per patch:** the data table needs maintenance (smaller than the full
  balance-data registry, but ongoing).
- **Idle time** stays an estimate without game events (chrono, reactor, research, cancels,
  WarpGates); the UI must label it honestly.
- **Non-Faster games** (custom/AI): different real-time factor → read `game_speed`.
- **Team games/Archon:** player switch and charts must handle more than two players; Archon
  shares control.
- **Chart library vs. own SVG components:** undecided.
- **Wider layout** for the detail page departs from the current `max-w-180`: design decision.
- **Game events** would significantly grow bundle (ability mapping), parse time and storage.
