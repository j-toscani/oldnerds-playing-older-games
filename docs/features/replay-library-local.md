# Feature: Persönliche Replay-Bibliothek (lokal im Browser)

> Abgeleitet aus [`replay-upload.md`](./replay-upload.md). Dieses Konzept ersetzt für die
> aktuelle Umsetzung den dort beschriebenen Organisator-/Server-Flow durch einen rein
> clientseitigen User-Flow. Der Server-Flow bleibt als spätere Ausbaustufe bestehen und
> wird hier **nicht** verworfen, sondern nur zurückgestellt.

## Zusammenfassung
User laden ihre SC2-Replay-Dateien auf der ONOG-Website hoch und bekommen die darin
enthaltenen Spieldaten (Spieler, Rassen, Map, Spieldauer, Zeitpunkt und — sofern ableitbar —
den Sieger) ausgelesen. **Der gesamte Vorgang läuft im Browser des Users**: Die Datei wird per
WASM-Parser lokal analysiert, das Ergebnis landet in der **IndexedDB** des Users und bleibt
dort. Es gibt kein Backend, keine Datenbank, keinen Upload — die Datei verlässt das Gerät nie.
Damit entsteht eine persönliche, wachsende Replay-Bibliothek, die der User selbst besitzt.
Eine spätere Synchronisierung mit dem Backend (und die Verknüpfung mit Matchups) ist bewusst
vorbereitet, aber ausdrücklich nicht Teil dieses Features.

## Motivation / Problem
Das ursprüngliche Replay-Konzept war **nicht live-fähig**: Es setzte ein Matchup-Ergebnisfeld
aus dem gemeinsamen Fundament (`shared-foundation.md`), einen SSE-Kanal, serverseitige
Hintergrundverarbeitung und einen zweiten OAuth-Flow (Battle.net) voraus. Diese Kette macht
das Feature zu einem Epic, das erst nach mehreren anderen Epics in `main` landen kann.

Gleichzeitig ist der eigentliche Kern — *„Was steckt in meinem Replay?"* — für den User schon
allein wertvoll und braucht nichts davon. Wenn die Daten im Browser bleiben:

- **Kein Blocker:** Keine Abhängigkeit auf `shared-foundation.md`, kein Matchup-Ergebnisfeld,
  kein SSE, kein Battle.net-OAuth. Das Feature ist eigenständig in `main` mergebar.
- **Kein Backend-Aufwand:** Datei-Empfang, Größen-/Rate-Limits, Job-Queue, Durability von
  `pending`-Einträgen, Single-Instance-Annahme — all diese Probleme aus dem alten Konzept
  entfallen ersatzlos.
- **Datenhoheit beim User:** Die Replays sind private Spieldaten. Sie liegen bei dem, dem sie
  gehören. Das ist kein Kompromiss, sondern das bessere Default-Verhalten.
- **Der Parser-Kern entsteht trotzdem:** Der WASM-Parser ist derselbe, den ein späterer
  Server-Flow braucht. Wir bauen also das schwierigste Stück zuerst — nur eben dort, wo es
  sofort Nutzen stiftet.

**Bewusster Trade-off:** Lokale Daten sind an Browser und Gerät gebunden. Wer den
Browser-Speicher leert, verliert die Bibliothek. Das wird im MVP nicht versteckt, sondern
adressiert (Storage-Persistenz anfordern, Hinweis in der UI, Export als Erweiterung).

## Zielgruppe
- **User / Spieler (MVP):** lädt eigene Replays hoch, sieht die extrahierten Spieldaten und
  behält sie als persönliche Bibliothek im Browser. Kein Login nötig.
- **Organisator (später):** nutzt denselben Parser, um Replays als Beleg an ein Matchup zu
  hängen — siehe `replay-upload.md`, ausdrücklich nicht Teil dieses Features.

## Scope

### MVP (Must-Have)
- **Technischer Spike zuerst** (siehe unten) — deutlich kleiner geschnitten als im alten
  Konzept, weil nur noch der Browser-Pfad relevant ist.
- **Parser-Package** `packages/replay-parser`: Rust-Crate auf Basis von `s2protocol-rs`,
  kompiliert zu WASM, als vorkompiliertes Artefakt eingecheckt (Begründung siehe
  Toolchain-Strategie).
- **Zwei neue Seiten unter `/analysis`**:
  - **Übersicht** (`/analysis`) — Datei-Auswahl, Parse-Fortschritt **und** die Tabelle der
    bereits analysierten Replays auf einer Seite. Upload und Bibliothek sind derselbe Ort;
    eine separate Upload-Seite wäre ein unnötiger Klick.
  - **Detailseite** (`/analysis/:replayId`) — zeigt die Daten eines einzelnen Replays.
- **Header-Link** in der bestehenden Navigation (`apps/website/src/routes/__root.tsx`) mit dem
  Label **„Replays analysieren"**, der auf `/analysis` zeigt.
- **Clientseitiges Parsen im Web Worker**: `File → arrayBuffer() → WASM parse → Ergebnisobjekt`.
  Der Worker hält den Main-Thread frei; die UI bleibt während des Parsens bedienbar.
- **Immer alles Extrahierbare speichern** (unverändertes Prinzip aus dem alten Konzept):
  Spieler (Name/Toon-Handle), Rassen, Map, Spieldauer, Spielzeitpunkt, Spielmodus/Spielerzahl
  und — sofern ableitbar — der erkannte Sieger. Ob die Sieger-Erkennung gelingt, ist **kein
  Go/No-Go-Gate**: die übrigen Metadaten sind für sich nützlich.
- **Persistenz in IndexedDB** über eine eigene Zugriffsschicht
  (`apps/website/src/lib/replay-db.ts`), analog zum bestehenden `lib/storage.ts`-Pattern
  (SSR-Guard, defensives Fehlerverhalten, klar benannte Funktionen).
- **Duplikat-Erkennung**: Ein Content-Hash der Datei ist der fachliche Schlüssel. Dieselbe
  Datei zweimal hochzuladen legt keinen zweiten Eintrag an, sondern meldet „bereits in deiner
  Bibliothek".
- **Mehrere Dateien auf einmal**: Auswahl mehrerer Replays, sequentielle Verarbeitung im
  Worker, Fortschritt und Fehler **pro Datei** sichtbar (eine kaputte Datei bricht den Rest
  nicht ab).
- **Bibliotheks-Tabelle** auf der Übersichtsseite: gespeicherte Replays mit den Kernfeldern
  (Spielzeitpunkt, Map, Spieler, Dauer), sortiert nach Spielzeitpunkt (neueste zuerst). Jede
  Zeile verlinkt auf die Detailseite. Einzelne Einträge löschbar, Bibliothek komplett leerbar.
- **Detailseite zeigt zunächst nur die formatierten Roh-Daten**: das gespeicherte
  `ReplayData`-Objekt als eingerücktes, lesbares JSON (`JSON.stringify(data, null, 2)` in einem
  `<pre>`). Das ist eine **bewusste Zwischenstufe** — sie macht sichtbar, was der Parser
  überhaupt liefert, und ist damit die Grundlage, um später zu entscheiden, wie die Daten
  aufbereitet dargestellt werden. Eine durchdachte Darstellung ist ausdrücklich ein eigenes,
  späteres Thema und wird hier nicht vorweggenommen.
- **UI-Zustände vollständig**: leer (noch keine Replays), Parsen läuft, Parse-Fehler,
  Duplikat, Erfolg. Kein Zustand bleibt unbeantwortet.
- **Storage-Persistenz anfordern**: `navigator.storage.persist()` beim ersten Speichern, plus
  ein ehrlicher Hinweis in der UI, dass die Daten lokal liegen und beim Leeren des
  Browser-Speichers verloren gehen.
- **Kein Login, keine Netzwerk-Anfrage** im gesamten Flow — nachprüfbar in den DevTools.

### Erweiterungen (Nice-to-Have / Später)
- **Export/Import als JSON** — schützt gegen Datenverlust und erlaubt Gerätewechsel. Starker
  Kandidat für die erste Erweiterung direkt nach dem MVP.
- **Optionales Behalten der Rohdatei** als Blob in der IndexedDB (pro Replay abschaltbar),
  damit ein Replay nach einem Parser-Update erneut ausgelesen werden kann.
- **Re-Parse bei neuer Parser-Version**: Jeder Eintrag speichert die `parserVersion`; nach
  einem Parser-Update können Einträge (mit vorhandener Rohdatei) neu ausgelesen werden.
- **Filtern/Suchen** nach Gegner, Map, Rasse, Zeitraum.
- **Drag & Drop** als Ergänzung zur Datei-Auswahl (nicht als Ersatz — der native
  `<input type="file">` bleibt der primäre, tastaturbedienbare Weg).
- **Aufbereitete Darstellung der Replay-Daten** auf der Detailseite (Spieler-Gegenüberstellung,
  Rassen-Icons, Map-Bild, Zeitleiste) — ersetzt die JSON-Rohansicht des MVP. Eigenes Konzept.
- **Persönliche Statistiken** über die Bibliothek (Winrate pro Matchup-Rasse, meistgespielte
  Maps) — reine Auswertung der bereits lokal vorhandenen Daten.
- **Backend-Sync** (eigenes Feature): Bibliothek optional mit dem eigenen Account
  synchronisieren.
- **Matchup-Verknüpfung** (siehe `replay-upload.md`): Replay als Beleg an ein Matchup hängen.

### Out-of-Scope
- **Jegliches Backend**: kein Upload-Endpoint, kein neues API-Model, keine SurrealDB-Tabelle,
  keine Hintergrundverarbeitung, kein Job-/Queue-Thema.
- **SSE / Live-Updates** — im lokalen Flow gibt es nichts zu pushen, das Parse-Ergebnis liegt
  synchron im selben Browser vor.
- **Battle.net-OAuth und Discord-Zuordnung** — ohne automatische Sieger-Übernahme in ein
  Matchup gibt es keinen Grund für den zweiten OAuth-Flow.
- **Automatisches Setzen eines Matchup-Siegers** und die gesamte Konfliktlogik
  („Organisator schlägt Replay") — entfällt, weil es kein serverseitiges Matchup-Ergebnis gibt.
- **Geräteübergreifende Verfügbarkeit** der Bibliothek.
- **Tiefenanalyse** (Build-Orders, APM-Graphen, Visualisierungen) über die Basis-Metadaten
  hinaus.

## Technisches Konzept

### Notwendiger Spike (vor der finalen Story-Schneidung)
Der Spike aus dem alten Konzept schrumpft von vier auf drei Punkte — die Frage nach der
serverseitigen Parse-Dauer und dem Job-Mechanismus entfällt vollständig:

1. **WASM-Bundle-Größe und Parse-Dauer im Browser** für reale Replay-Dateien. Referenzwert aus
   der Recherche: *Recoil Analytics* parst CS2-Demos clientseitig mit ~800 KB WASM-Binary.
   Entscheidungskriterium: Bleibt das Artefakt in einer Größenordnung, die man einer Website
   zumuten kann, und lädt es **lazy** nur auf der Replay-Route?
2. **Sieger-Ableitung**: Wie lässt sich der Sieger aus den Replay-Daten zuverlässig ermitteln?
   `s2protocol-rs` dokumentiert das nicht; die Logik muss über Details-/Tracker-Events selbst
   ergänzt und an echten Replays verifiziert werden. **Kein Gate** — schlägt es fehl, speichert
   das Feature die übrigen Metadaten und lässt das Sieger-Feld leer.
3. **Toolchain-Integration**: `wasm-pack`-Build, `vite-plugin-wasm` (ggf.
   `vite-plugin-top-level-await`) und der Client-only-Ladepfad unter dem Nitro-`bun`-Preset.

**Konsequenz für die Ticket-Erstellung:** Der Spike wird das erste Issue. Die übrigen Stories
(IndexedDB-Schicht, Route/UI, Worker-Anbindung) sind unabhängig vom Spike-Ergebnis nötig und
werden danach nur noch bezüglich Sieger-Feld und Ladepfad nachgeschärft.

### Betroffene Bereiche
| Bereich | Art | Inhalt |
|---|---|---|
| `packages/replay-parser` | **neu** | Rust-Crate (`s2protocol-rs`), Ausgabe: WASM-Artefakt + TS-Bindings. Einzige nicht-TS-Komponente im Monorepo. |
| `apps/website/src/routes/analysis/index.tsx` | **neu** | Übersicht: Datei-Auswahl, Parse-Status, Tabelle der analysierten Replays. |
| `apps/website/src/routes/analysis/$replayId.tsx` | **neu** | Detailseite: lädt einen Eintrag aus der IndexedDB, rendert ihn als formatiertes JSON. |
| `apps/website/src/routes/__root.tsx` | **erweitert** | Header-Link „Replays analysieren" → `/analysis` in der bestehenden `<nav>`. |
| `apps/website/src/lib/replay-db.ts` | **neu** | IndexedDB-Zugriffsschicht (`saveReplay`, `listReplays`, `getReplay`, `deleteReplay`, `clearReplays`) im Stil von `lib/storage.ts`. |
| `apps/website/src/lib/replay-parser.worker.ts` | **neu** | Web Worker, lädt das WASM-Modul und parst `ArrayBuffer` → Ergebnisobjekt. |
| `apps/website/src/components/` | **erweitert** | Upload-Kontrolle und Replay-Liste/-Karte — **vor dem Bau** den Skill `component-library` lesen und bestehende Bausteine (`Button`, `game-ui.tsx`, `layout.tsx`) wiederverwenden statt neu zu erfinden. |
| `apps/website/vite.config.ts` | **erweitert** | `vite-plugin-wasm` (+ ggf. `vite-plugin-top-level-await`). |
| `packages/shared/src/types.ts` | **erweitert** | Typ `ReplayData` — siehe Hinweis unten. |
| `apps/api/` | **unberührt** | Ausdrücklich keine Änderung. |
| CI/CD | **erweitert** | Rust/`wasm-pack`-Job **nur** bei Änderungen unterhalb `packages/replay-parser`, nicht im Standard-`bun run build`. |

**Hinweis zu `packages/shared`:** Laut `CLAUDE.md` spiegeln die Shared-Types die
SurrealDB-Models. `ReplayData` hat (noch) kein Model — der Typ gehört trotzdem dorthin, weil
er die Schnittstelle zwischen Parser-Package und Website ist und ein späterer Sync ihn
unverändert weiterverwenden kann. Wenn irgendwann ein `replay`-Model entsteht, greift die
übliche Regel aus dem Skill `sync-schema-types`.

### Architektur
Ein einziger Flow, vollständig im Browser:

```mermaid
flowchart LR
    A[User wählt .SC2Replay] --> B[file.arrayBuffer]
    B --> C[Web Worker]
    C --> D[WASM-Parser<br/>packages/replay-parser]
    D --> E[ReplayData + contentHash]
    E --> F{Hash bereits<br/>in der DB?}
    F -- ja --> G[Hinweis: bereits vorhanden]
    F -- nein --> H[IndexedDB: put]
    H --> I[Bibliotheksliste aktualisiert]
```

Kein Pfeil in diesem Diagramm verlässt den Browser. Genau das ist die Kernaussage des
Features.

**Seiten & Navigation.** Die Route liegt als eigenes Verzeichnis `routes/analysis/` (analog zu
`routes/api/`), damit Übersicht und Detailseite ohne Namens-Akrobatik nebeneinander liegen. Die
Detailseite bekommt die `replayId` aus dem Pfad und liest den Eintrag direkt aus der IndexedDB —
sie ist damit **client-only**: serverseitig gibt es die Daten nicht, ein Direktaufruf oder Reload
rendert zunächst einen Ladezustand und danach den Eintrag (oder eine „nicht gefunden"-Meldung,
z.B. nach dem Löschen oder auf einem anderen Gerät). Der Header-Link ist ein einfacher
`<Link to="/analysis">` in der bestehenden `<nav>` in `__root.tsx` — kein neues
Navigationskonzept, die App wird im kleinen Kreis genutzt.

**Datenmodell (IndexedDB).** Eine Datenbank `onog-replays`, ein Object Store `replays`,
Primärschlüssel ist eine generierte `id`. Ein **Unique-Index auf `contentHash`** erzwingt die
Duplikatfreiheit auf Datenbank-Ebene statt nur in der UI; ein Index auf `playedAt` bedient die
Standard-Sortierung ohne vollständigen Scan.

Ein Eintrag hält im Kern:

- `id`, `contentHash`, `fileName`, `importedAt`
- `parserVersion` — nötig, um später gezielt neu auslesen zu können
- `playedAt`, `map`, `durationSeconds`, `gameVersion`
- `players[]` — Name/Toon-Handle, Rasse, Team, Ergebnis (soweit erkannt)
- `winner` — optional, leer wenn nicht ableitbar

Bewusst **nicht** enthalten: Sync-Status, Server-IDs, User-Zuordnung. Die kommen, wenn der
Sync gebaut wird — vorher wären sie spekulative Felder ohne Leser.

**Versionierung des Stores.** Die IndexedDB-Version wird von Anfang an über einen
`onupgradeneeded`-Handler geführt, damit ein späteres Feld additiv ergänzt werden kann, ohne
die Bibliothek der User zu zerstören. Ein Migrationspfad, der bereits gespeicherte Einträge
verwirft, ist keine Option — die Daten existieren nirgendwo sonst.

**Vorbereitung auf den späteren Sync (ohne ihn zu bauen).** Zwei Entscheidungen genügen:
`ReplayData` liegt in `packages/shared` und ist frei von browser-spezifischen Typen, und
`contentHash` ist ein stabiler, geräteunabhängiger Schlüssel. Damit ist ein späterer Sync ein
additives Feature statt einer Neumodellierung — mehr Vorleistung ist nicht nötig.

**Ladepfad / SSR.** Das WASM-Modul darf unter dem Nitro-`bun`-Preset nicht in den
Server-Bundle geraten. Der Worker wird deshalb erst clientseitig instanziiert, das
WASM-Modul lazy im Worker geladen. Die Route rendert serverseitig nur die Hülle; Bibliothek
und Parser sind ausschließlich Client-Belange — dieselbe Grundregel, nach der auch
`lib/storage.ts` mit `typeof window === 'undefined'` arbeitet.

### Toolchain-Strategie: vorkompiliertes WASM einchecken
Unverändert gültig aus dem alten Konzept, hier sogar mit weniger Zielkonflikt, weil es nur
noch **ein** Konsumziel gibt:

- Das **vorkompilierte WASM-Artefakt wird versioniert eingecheckt** und von der Website wie
  eine fertige Dependency konsumiert.
- **Normale Contributor brauchen kein Rust lokal** — nur wer den Parser-Crate ändert,
  kompiliert neu (oder ein pfadgebundener CI-Job tut es).
- `bun run build` bleibt reine Bun/TS-Toolchain.
- Bewusste Abweichung von der „kein Build-Step"-Konvention (`packages/shared` wird als Source
  konsumiert) — vertretbar, weil die Alternative (Rust im Setup jedes Contributors) für ein
  selten geändertes Package unverhältnismäßig wäre. Ein CI-Check sollte sicherstellen, dass
  Artefakt und Quelle nicht auseinanderlaufen.

### Abhängigkeiten
- **Extern:** `s2protocol-rs` (Rust), `wasm-pack`, `vite-plugin-wasm`
  (+ ggf. `vite-plugin-top-level-await`). Für die IndexedDB-Schicht ist eine kleine
  Promise-Wrapper-Bibliothek (z.B. `idb`) vertretbar — die native IndexedDB-API ist
  event-basiert und passt schlecht zum sonstigen `async/await`-Stil. Entscheidung im Rahmen
  der Umsetzung; ohne Wrapper geht es auch, kostet aber Boilerplate.
- **Intern: keine.** Insbesondere **keine** Abhängigkeit auf `shared-foundation.md`,
  `feature-concept.md` (Turniermodus) oder eine API-Änderung. Das ist der zentrale Unterschied
  zum Vorgängerkonzept und der Grund, warum dieses Feature direkt in `main` kann.

### Risiken
- **Datenverlust durch Browser-Speicher:** IndexedDB kann vom Browser geräumt werden — bei
  Safari greifen Storage-Policies besonders schnell, wenn der Speicher nicht als „persistent"
  markiert ist. Gegenmaßnahmen: `navigator.storage.persist()` anfordern, ehrlicher Hinweis in
  der UI, Export als erste Erweiterung. Vollständig ausschließen lässt sich der Verlust nicht —
  das ist der Preis für „Daten bleiben beim User".
- **Parser-Kern bleibt das größte Unbekannte:** Bundle-Größe, Parse-Dauer und vor allem die
  undokumentierte Sieger-Logik. Anders als früher ist das jetzt aber das *einzige* echte
  Risiko — und es ist über den Spike eingegrenzt.
- **Neue Toolchain im Monorepo:** Rust + `wasm-pack` sind bisher nicht Teil des Bun/TS-Stacks.
  Durch das eingecheckte Artefakt trifft das nur Parser-Contributor. Restrisiko:
  Artefakt und Quelle müssen konsistent gehalten werden.
- **SSR-Kompatibilität:** Ein versehentlich serverseitig gebündeltes WASM-Modul bricht den
  Build oder die Route. Client-only-Ladepfad ist Pflicht, nicht Kür.
- **Speicherverbrauch bei aktivierter Rohdaten-Ablage** (Erweiterung): Replays sind klein
  (typisch < ~5 MB), summieren sich über eine große Bibliothek aber. Deshalb ist das Behalten
  der Rohdatei optional und nicht Default.
- **Migrationspfad zum späteren Sync:** Wenn der Sync kommt, existieren Bibliotheken mit
  unterschiedlichem Stand auf verschiedenen Geräten. Konfliktauflösung ist ein Problem des
  Sync-Features — hier nur insoweit relevant, als `contentHash` ein stabiler Schlüssel bleiben
  muss.

## Offene Fragen
- **Wrapper-Bibliothek für IndexedDB (`idb`) oder native API?** Kleine, umkehrbare Entscheidung
  — kann im Rahmen der Umsetzung fallen, blockiert nichts.
- Die technischen Unsicherheiten (Bundle-Größe, Parse-Dauer, Sieger-Logik) sind bewusst als
  **Spike** eingeplant und deshalb hier keine offenen Fragen.
