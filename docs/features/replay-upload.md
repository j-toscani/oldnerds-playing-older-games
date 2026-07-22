# Feature: Replay-Upload zur Ergebnis-Verifizierung

## Zusammenfassung
Zwei Flows zum Auslesen von SC2-Replay-Dateien: Organisatoren laden ein Replay direkt auf einer Matchup-Seite hoch, um den Turnier-Sieger nachweisbar (statt per Selbstauskunft) festzulegen — die Datei wird an den Server geschickt und dort asynchron im Hintergrund verarbeitet. User können (als spätere Erweiterung) eigene Replays unabhängig von einem Matchup rein clientseitig per WASM analysieren, ohne dass die Datei das Gerät verlässt. Beide Flows nutzen denselben Parser-Kern (Rust-Crate, aufbauend auf `s2protocol-rs`), das Ergebnis wird als eigenständige, referenzierbare Replay-Entität gespeichert.

## Motivation / Problem
Aktuell werden Matchup-Ergebnisse (sobald ein Sieger-Feld existiert, siehe Turniermodus-Konzept) rein per Selbstauskunft eingetragen. SC2-Replay-Dateien enthalten objektiv nachvollziehbare Spieldaten inkl. Sieger. Für den Turnierbetrieb (Organisator bestimmt das offizielle Ergebnis) ist entscheidend, dass der Organisator nicht auf einen synchronen Parse-Vorgang warten muss — die tatsächliche Dauer ist aber unbekannt, weshalb die konkrete technische Ausgestaltung von einem vorgeschalteten Spike abhängt.

## Recherche: Parser-Bibliotheken & WASM-Tauglichkeit
Kein SC2-Replay-Parser erfüllt gleichzeitig "zuverlässige Sieger-Erkennung" UND "erprobt klein/schnell zu WASM":

| Bibliothek | Sprache | Status | Sieger-Erkennung | WASM-Eignung |
|---|---|---|---|---|
| `ggtracker/sc2reader` | Python | aktiv (Release 06/2024) | ✅ explizites `winner`-Feld | ❌ Pyodide-Overhead mehrere MB nur Interpreter |
| `icza/s2prot` | Go | aktiv (Release 10/2024) | ✅ Result/Victory über Tracker-Events | ⚠️ Standard-Go-WASM 7–12 MB+; TinyGo riskant (reflection/`encoding/json`) |
| `sebosp/s2protocol-rs` | Rust | aktiv (Commits bis 08/2025) | ❓ nicht dokumentiert, selbst zu ergänzen | ✅ reifstes/kleinstes WASM-Tooling (wasm-pack), gute Vite-Plugins |
| Reines JS/TS für SC2 | – | existiert praktisch nicht (nur für Brood War, z.B. `screparsed`) | – | – |

Starkes Signal gegen den Go-Weg: Der Maintainer von `screp-js` (Go→GopherJS-Portierung eines eng verwandten Parsers) ist selbst zu einer reinen TypeScript-Neuimplementierung gewechselt, weil die Go-Route "significantly slower than running the native binary" war. Präzedenzfall für den Rust-Weg: *Recoil Analytics* parst CS2-Demo-Dateien vollständig clientseitig via Rust→wasm-pack (~800 KB Binary), läuft in einem Web Worker, Datei verlässt nie das Gerät.

**Entscheidung:** Rust-Crate (`s2protocol-rs`) als Basis für den Parser-Kern. Die Sieger-Logik ist nicht dokumentiert und muss selbst über die Tracker-Events ergänzt/verifiziert werden.

## Zielgruppe
- **Organisator** (MVP): lädt ein Replay zu einem Matchup hoch, um dessen Sieger nachweisbar festzulegen
- **User** (später): lädt eigene Replays zur persönlichen Analyse hoch, unabhängig von einem Matchup

## Scope

### MVP (Must-Have) — Organisator-Flow
- **Technischer Spike zuerst** (siehe Technisches Konzept) — Ergebnis bestimmt die konkrete Ausgestaltung der folgenden Punkte
- Replay-Upload für Organisatoren direkt auf der Matchup-Seite (`matchup.tsx`), Datei wird an den Server übertragen
- Serverseitiges, asynchrones Parsen im Hintergrund (konkreter Mechanismus abhängig vom Spike: einfacher Fire-and-Forget-Task vs. echte Job-Queue)
- Replay als eigene Entität mit Verarbeitungsstatus (`pending` → `done`/`failed`): Sieger, Spieler laut Replay-Daten, Map, Spieldauer, Rassen
- Matchup hält nur eine Referenz (`replayId`) auf den Replay-Datensatz, kein eingebettetes Ergebnis-Objekt
- Organisator sieht den Verarbeitungsstatus in der UI, ohne blockierend warten zu müssen (siehe SSE-Architektur unten)
- Roh-Datei wird nach der Verarbeitung verworfen (kein dauerhafter Datei-Storage)

### Erweiterungen (Nice-to-Have / Später) — User-Flow
- Allgemeiner Replay-Upload-Bereich unabhängig von einem Matchup, in dem User eigene Replays rein clientseitig (WASM im Browser, synchron, Datei verlässt nie das Gerät) für sich analysieren können
- Map-Verifizierung: gespielte Map laut Replay vs. Veto-Ergebnis

### Out-of-Scope
- Dauerhafte Speicherung der Roh-Replay-Datei (Audit-Trail)
- Automatisches Spieler-Matching über Discord/Battle.net-Identität
- Tiefergehende Replay-Analyse (Build-Orders, APM-Graphen, Visualisierungen) über die Basis-Metadaten hinaus

## Technisches Konzept

### Notwendiger Spike (vor Ausgestaltung der finalen Stories)
Zu klären, bevor die Organisator-Flow-Stories final geschnitten werden:
1. Tatsächliche Parse-Dauer für reale Replay-Dateien mit `s2protocol-rs` — entscheidet, ob serverseitig ein einfacher async Task reicht oder eine echte Job-Queue nötig ist.
2. Tatsächliche WASM-Bundle-Größe für den clientseitigen (User-)Flow.
3. Wie sich der Sieger zuverlässig aus den Replay-Events ableiten lässt (nicht dokumentiert in `s2protocol-rs`).
4. Ob derselbe Rust-Parser-Kern für beide Flows wiederverwendbar ist (WASM auch serverseitig über Bun ausführen) oder ob getrennte Build-Targets nötig sind (WASM für Client, natives Modul/Subprocess für Server).

**Konsequenz für die Ticket-Erstellung:** Dieser Spike sollte als eigenes, erstes Issue umgesetzt werden. Die übrigen Organisator-Flow-Stories sind vorläufig und werden nach dem Spike-Ergebnis nachgeschärft.

### Betroffene Bereiche
- Neues Package, z.B. `packages/replay-parser` — Rust-Crate (nutzt `s2protocol-rs` als Dependency), Build-Target(s) abhängig vom Spike (WASM für Client, ggf. zusätzlich natives Target für den Server)
- Neues Backend-Model/Route, z.B. `apps/api/src/models/replay.ts` + `apps/api/src/routes/replays.ts` — eigene SurrealDB-Tabelle `replay` mit Status-Feld, Spielern (laut Replay-Daten), Sieger, Map, Spieldauer, Rassen
- Backend braucht neue Infrastruktur für Datei-Empfang (roher Binary-Body, kein Multipart-Parsing nötig) und Hintergrundverarbeitung (aktuell keine Job-Queue im Stack) — konkrete Lösung abhängig vom Spike
- Neuer SSE-Endpoint (z.B. `GET /api/gamedays/:id/events`) für Live-Updates — generische Infrastruktur, die sowohl den Replay-Verarbeitungsstatus als auch zukünftig Turniermodus-Änderungen (Standings, neue Matchups) an alle Zuschauer/Teilnehmer pushen kann
- `apps/website/src/routes/matchup.tsx` — Upload-UI für Organisatoren inkl. Status-Anzeige über die SSE-Verbindung (kein Polling)
- `apps/website/vite.config.ts` — `vite-plugin-wasm` (+ ggf. `vite-plugin-top-level-await`) für den späteren clientseitigen User-Flow
- `packages/shared/src/types.ts` — neuer Typ `Replay` (Status, Spieler, Sieger, Map, Dauer, Rassen); `Matchup`/`MatchupWithState` bekommt ein optionales `replayId`-Referenzfeld — Überschneidung mit der im Turniermodus-Konzept identifizierten Lücke ("kein Ergebnis-Feld im Datenmodell"); beide Features sollten sich auf ein gemeinsames Sieger-Konzept am Matchup abstimmen
- CI/CD (`#25`-Pipeline) — neuer Build-Schritt für die Rust/wasm-pack-Kompilierung, da bisher nur Bun/TS-Toolchain im Monorepo existiert

### Architektur
Zwei getrennte Flows mit gemeinsamem Parser-Kern:
1. **Organisator-Flow (MVP):** Matchup-Seite → Datei-Upload → `POST /api/matchups/:id/replay` mit **rohem Binary-Body** (`Content-Type: application/octet-stream`, Body = `file` direkt als Fetch-Body) statt multipart/form-data — die Matchup-ID steht in der URL, es gibt keine weiteren Formularfelder, daher kein Bedarf für Multipart; Client sendet einfach `fetch(url, { method: 'POST', body: file })`, Server liest den Body direkt als `ArrayBuffer` (kein zusätzliches Multipart-Parsing-Package nötig) → Backend nimmt die Datei temporär entgegen, legt Replay-Datensatz mit Status `pending` an → asynchrone Verarbeitung im Hintergrund (Mechanismus laut Spike) → Status wechselt zu `done`/`failed`, Ergebnisfelder werden befüllt → Rohdatei wird verworfen → Matchup referenziert die Replay-ID
2. **Status-Updates per SSE statt Polling:** Statt der Status-Änderung per Polling nachzufragen, öffnet das Frontend eine Server-Sent-Events-Verbindung für das Turnier/den Gameday. Das ist bewusst nicht replay-spezifisch gedacht, sondern als genereller Live-Update-Kanal für alle, die sich das Turnier gerade ansehen (Zuschauer, andere Teilnehmer) — Replay-Status ist nur eine der Events, die darüber laufen. Das überschneidet sich mit dem Turniermodus-Konzept (dort sind Standings-/Matchup-Änderungen ebenfalls live-relevant) und sollte als gemeinsame Infrastruktur betrachtet werden, nicht als replay-eigenes Feature.
3. **User-Flow (später):** vollständig clientseitig — Datei → `file.arrayBuffer()` → WASM-`parse`-Funktion → Ergebnis direkt im Browser, keine Backend-Interaktion nötig

### Risiken
- **Spike-Abhängigkeit:** Parse-Dauer, Sieger-Erkennungslogik und Wiederverwendbarkeit des Parser-Kerns client-/serverseitig sind unbekannt — alle nachgelagerten Stories sind bis dahin vorläufig.
- **Neue Backend-Infrastruktur nötig:** Datei-Empfang und Hintergrundverarbeitung existieren aktuell überhaupt nicht im Stack (nur Hono + SurrealDB) — größerer Aufwand als ein rein clientseitiger Ansatz, aber für den Organisator-Anwendungsfall (nicht warten müssen) die passendere UX.
- **Neue Toolchain im Monorepo:** Rust + `wasm-pack` sind bisher nicht Teil des Bun/TS-Stacks.
- **SSR-Kompatibilität (User-Flow):** WASM-Modul darf nicht versehentlich serverseitig gebündelt werden (Nitro-Preset `bun`) — Client-only-Ladepfad nötig.
- **Schema-Abstimmung mit Turniermodus-Konzept:** Das Sieger-/Ergebnis-Konzept am Matchup (Referenz auf Replay vs. manuell erfasstes Ergebnis) sollte mit dem dortigen Konzept abgestimmt werden.
- **SSE als neue, geteilte Infrastruktur:** Der Live-Update-Kanal ist bewusst generisch für Turnier-Updates gedacht, nicht nur für Replay-Status — das vergrößert den Scope dieses Features leicht (Verbindungsmanagement, Reconnect-Verhalten, wer welche Events empfängt), zahlt sich aber auch für den Turniermodus aus. Sollte mit dem Turniermodus-Konzept abgestimmt werden, damit nicht zwei separate Live-Update-Lösungen entstehen.

## Offene Fragen
Keine offenen Produktentscheidungen — die verbleibenden Unsicherheiten (Parse-Dauer, Sieger-Logik, Bundle-Größe, Wiederverwendbarkeit des Parser-Kerns) sind bewusst als **Spike** vor der eigentlichen Umsetzung eingeplant, nicht als offene Fragen im Konzept selbst.
