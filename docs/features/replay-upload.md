# Feature: Replay-Upload zur Ergebnis-Verifizierung

## Zusammenfassung
Zwei Flows zum Auslesen von SC2-Replay-Dateien: Organisatoren laden ein Replay direkt auf einer Matchup-Seite hoch, um es als objektiven Beleg an das Matchup zu hängen — die Datei wird an den Server geschickt und dort asynchron im Hintergrund verarbeitet. **Der Upload speichert immer alles, was aus dem Replay extrahierbar ist** (Spieler laut Replay, Map, Spieldauer, Rassen und — sofern ableitbar — der Sieger). Ob daraus der Matchup-Sieger *automatisch* gesetzt werden kann, hängt an zwei unabhängigen Achsen (Sieger im Replay erkennbar? Replay-Spieler einer Discord-Identität zuordenbar?); ist eine davon nicht erfüllt, legt der Organisator den Sieger manuell fest — der extrahierte Sieger dient dann als Vorschlag. User können (als spätere Erweiterung) eigene Replays unabhängig von einem Matchup rein clientseitig per WASM analysieren, ohne dass die Datei das Gerät verlässt. Beide Flows nutzen denselben Parser-Kern (Rust-Crate, aufbauend auf `s2protocol-rs`), das Ergebnis wird als eigenständige, referenzierbare Replay-Entität gespeichert.

## Motivation / Problem
Aktuell werden Matchup-Ergebnisse (sobald ein Sieger-Feld existiert, siehe gemeinsames Fundament `shared-foundation.md`) rein per Selbstauskunft eingetragen. **Harte Abhängigkeit:** Dieses Feature setzt das Matchup-Ergebnis-Feld aus dem gemeinsamen Fundament voraus und darf nicht davor begonnen werden. SC2-Replay-Dateien enthalten objektiv nachvollziehbare Spieldaten. Ein hochgeladenes Replay ist damit ein wertvoller Beleg zum Matchup — unabhängig davon, ob wir den Sieger automatisch daraus ableiten können. Für den Turnierbetrieb (Organisator bestimmt das offizielle Ergebnis) ist entscheidend, dass der Organisator nicht auf einen synchronen Parse-Vorgang warten muss — die tatsächliche Dauer ist aber unbekannt, weshalb die konkrete technische Ausgestaltung von einem vorgeschalteten Spike abhängt.

**Kein Go/No-Go-Gate:** Der Wert des Features hängt *nicht* daran, dass die Sieger-Erkennung gelingt. Selbst wenn der Sieger nicht zuverlässig aus dem Replay ableitbar ist, liefert der Upload nützliche, objektive Metadaten (Spieler, Map, Dauer, Rassen) und dient als Beleg. Der Spike zur Sieger-Erkennung ist deshalb eine **Weichenstellung** ("Sieger automatisch vorschlagbar vs. rein manuell"), kein Existenz-Gate für das Feature.

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
- **Organisator** (MVP): lädt ein Replay zu einem Matchup hoch, erhält daraus die extrahierten Spieldaten und (sofern ableitbar) einen Sieger-Vorschlag und bestätigt/setzt den Matchup-Sieger
- **Teilnehmer/User** (MVP): verknüpft optional sein Battle.net-Konto mit seiner Discord-Identität, damit erkannte Replay-Sieger automatisch zugeordnet werden können
- **User** (später): lädt eigene Replays zur persönlichen Analyse hoch, unabhängig von einem Matchup

## Scope

### MVP (Must-Have) — Organisator-Flow
- **Technischer Spike zuerst** (siehe Technisches Konzept) — Ergebnis bestimmt die konkrete Ausgestaltung der folgenden Punkte (Parse-Mechanismus, ob Sieger automatisch vorschlagbar)
- Replay-Upload für Organisatoren direkt auf der Matchup-Seite (`matchup.tsx`), Datei wird an den Server übertragen
- Serverseitiges, asynchrones Parsen im Hintergrund (konkreter Mechanismus abhängig vom Spike: einfacher Fire-and-Forget-Task vs. echte Job-Queue)
- **Immer alles Extrahierbare speichern:** Replay als eigene Entität mit Verarbeitungsstatus (`pending` → `done`/`failed`): Spieler laut Replay-Daten (Name/Toon-Handle), Map, Spieldauer, Rassen und — sofern ableitbar — der erkannte Sieger. Der Upload/das Speichern ist der Kern und funktioniert unabhängig davon, ob die Sieger-Erkennung gelingt
- **Sieger-Ableitung in zwei Achsen** (siehe Architektur): (a) ist der Sieger aus den Replay-Events erkennbar? (b) lässt sich der siegreiche Replay-Spieler einer Discord-Identität zuordnen (via Battle.net-Verknüpfung)? Nur wenn **beides eindeutig** ist, wird der Matchup-Sieger automatisch gesetzt; sonst wird der erkannte Sieger als **Vorschlag** hinterlegt und der Organisator legt den Matchup-Sieger manuell fest
- **Battle.net↔Discord-Verknüpfung**: User können ihr Battle.net-Konto mit ihrer Discord-Identität verknüpfen (zweiter OAuth-Flow neben dem bestehenden Discord-Login). Erst diese Verknüpfung erlaubt die automatische Zuordnung eines Replay-Spielers (Toon-Handle) zu einem angemeldeten Teilnehmer
- Matchup hält nur eine Referenz (`replayId`) auf den Replay-Datensatz, kein eingebettetes Ergebnis-Objekt
- Organisator sieht den Verarbeitungsstatus in der UI, ohne blockierend warten zu müssen (siehe SSE-Architektur unten)
- Roh-Datei wird nach der Verarbeitung verworfen (kein dauerhafter Datei-Storage) — bewusster Trade-off: der Beleg ist danach nicht erneut parsebar, es bleiben nur die extrahierten Felder. Bei einem späteren Ergebnis-Disput steht also die Extraktion, nicht die Originaldatei zur Verfügung (Audit-Trail bleibt Out-of-Scope)
- Upload-Endpoint: nur Turnier-Owner, hartes Größen-Limit (~10 MB) und einfaches Rate-Limit; Namespace an bestehende geschützte Gameday/Turnier-Route angeglichen (siehe Architektur)

### Erweiterungen (Nice-to-Have / Später) — User-Flow
- Allgemeiner Replay-Upload-Bereich unabhängig von einem Matchup, in dem User eigene Replays rein clientseitig (WASM im Browser, synchron, Datei verlässt nie das Gerät) für sich analysieren können
- Map-Verifizierung: gespielte Map laut Replay vs. Veto-Ergebnis

### Out-of-Scope
- Dauerhafte Speicherung der Roh-Replay-Datei (Audit-Trail)
- Tiefergehende Replay-Analyse (Build-Orders, APM-Graphen, Visualisierungen) über die Basis-Metadaten hinaus

> Hinweis: Das automatische Spieler-Matching über die Battle.net-Identität war ursprünglich Out-of-Scope, ist nun aber bewusst **MVP-Bestandteil** (Battle.net↔Discord-Verknüpfung, siehe MVP). Ohne vorhandene Verknüpfung fällt die Sieger-Zuordnung sauber auf die manuelle Organisator-Entscheidung zurück.

## Technisches Konzept

### Notwendiger Spike (vor Ausgestaltung der finalen Stories)
Zu klären, bevor die Organisator-Flow-Stories final geschnitten werden:
1. Tatsächliche Parse-Dauer für reale Replay-Dateien mit `s2protocol-rs` — entscheidet, ob serverseitig ein einfacher async Task reicht oder eine echte Job-Queue nötig ist. **Entscheidungskriterien** (bewusst erst nach dem Spike zu entscheiden): (a) Parse-Dauer im Verhältnis zu einem akzeptablen Wartefenster; (b) Durability — was passiert mit einem `pending`-Replay bei Prozess-Neustart/Absturz während der Verarbeitung; (c) ob mehr als eine API-Instanz betrieben wird (Single-Instance-Annahme, siehe unten).
2. Tatsächliche WASM-Bundle-Größe für den clientseitigen (User-)Flow.
3. Wie sich der Sieger zuverlässig aus den Replay-Events ableiten lässt (nicht dokumentiert in `s2protocol-rs`).
4. Ob derselbe Rust-Parser-Kern für beide Flows wiederverwendbar ist (WASM auch serverseitig über Bun ausführen) oder ob getrennte Build-Targets nötig sind (WASM für Client, natives Modul/Subprocess für Server).

**Konsequenz für die Ticket-Erstellung:** Dieser Spike sollte als eigenes, erstes Issue umgesetzt werden. Er ist aber **kein Go/No-Go-Gate** für das Feature: Der Upload und das Speichern der extrahierbaren Metadaten werden ohnehin gebaut. Der Spike entscheidet lediglich, ob die Sieger-Erkennung als **automatischer Vorschlag** angeboten wird (Punkt 3 gelingt) oder ob der Sieger im MVP rein manuell durch den Organisator gesetzt wird. Die übrigen Organisator-Flow-Stories (Upload, Parsing-Infrastruktur, Statusanzeige) sind unabhängig davon nötig und werden nach dem Spike-Ergebnis nur hinsichtlich Parse-Mechanismus/Sieger-Vorschlag nachgeschärft.

### Betroffene Bereiche
- Neues Package, z.B. `packages/replay-parser` — Rust-Crate (nutzt `s2protocol-rs` als Dependency). **Ausgabe ist ein plattformunabhängiges WASM-Artefakt**, das sowohl im Browser als auch serverseitig über Bun läuft — es braucht daher kein OS-spezifisches natives Target, ein Artefakt genügt für beide Flows.
- Neues Backend-Model/Route, z.B. `apps/api/src/models/replay.ts` + `apps/api/src/routes/replays.ts` — eigene SurrealDB-Tabelle `replay` mit Status-Feld, Spielern (laut Replay-Daten), Sieger, Map, Spieldauer, Rassen
- **Battle.net-OAuth-Flow** (`apps/api/src/routes/auth.ts` erweitern) — zweiter OAuth-Provider neben Discord; speichert das Battle.net-Toon-Handle am User-Datensatz und verknüpft es mit der Discord-Identität. Frontend: Konto-Verknüpfungs-UI (z.B. in `UserMenu.tsx`/Profil). Erst diese Zuordnung erlaubt, einen Replay-Spieler automatisch einem angemeldeten Teilnehmer zuzuordnen
- Backend braucht neue Infrastruktur für Datei-Empfang (roher Binary-Body, kein Multipart-Parsing nötig) und Hintergrundverarbeitung (aktuell keine Job-Queue im Stack) — konkrete Lösung abhängig vom Spike
- Neuer SSE-Endpoint (z.B. `GET /api/gamedays/:id/events`) für Live-Updates — generische Infrastruktur, die sowohl den Replay-Verarbeitungsstatus als auch zukünftig Turniermodus-Änderungen (Standings, neue Matchups) an alle Zuschauer/Teilnehmer pushen kann
- `apps/website/src/routes/matchup.tsx` — Upload-UI für Organisatoren inkl. Status-Anzeige über die SSE-Verbindung (kein Polling)
- `apps/website/vite.config.ts` — `vite-plugin-wasm` (+ ggf. `vite-plugin-top-level-await`) für den späteren clientseitigen User-Flow
- `packages/shared/src/types.ts` — neuer Typ `Replay` (Status, Spieler, Sieger, Map, Dauer, Rassen); `Matchup`/`MatchupWithState` bekommt ein optionales `replayId`-Referenzfeld; `User` bekommt ein optionales Battle.net-Feld (Toon-Handle) — Überschneidung mit der im Turniermodus-Konzept identifizierten Lücke ("kein Ergebnis-Feld im Datenmodell"); beide Features sollten sich auf ein gemeinsames Sieger-Konzept am Matchup abstimmen
- CI/CD (`#25`-Pipeline) — Rust/wasm-pack-Kompilierung nur als **isolierter, seltener Schritt**, nicht als Teil des Standard-`bun run build`

### Toolchain-Strategie: vorkompiliertes WASM einchecken
Der Parser muss **nicht bei jedem Build** kompiliert werden. Das WASM-Artefakt ist plattformunabhängig und ändert sich nur, wenn sich der Parser-Crate selbst ändert (neue Sieger-Logik, Bugfix, `s2protocol-rs`-Update). Daraus die bewusste Strategie:
- Das **vorkompilierte WASM-Artefakt wird versioniert eingecheckt** (bzw. als Release-Artefakt bereitgestellt) und von website/api wie eine fertige Dependency konsumiert.
- **Normale Contributor brauchen kein Rust lokal** — nur wer den Parser-Crate editiert, kompiliert neu (oder ein auf `packages/replay-parser` beschränkter CI-Job kompiliert bei Änderungen an diesem Pfad).
- `bun run build`/der reguläre Turborepo-Flow bleibt reine Bun/TS-Toolchain; der Rust-Build ist ein seltener, isolierter Vorgang.
- Konsequenz: Ein eingechecktes Build-Artefakt ist eine bewusste Abweichung von der sonstigen "kein Build-Step"-Konvention (`packages/shared` wird als Source konsumiert) — vertretbar, weil die Alternative (Rust im Setup jedes Contributors) für ein selten geändertes Package unverhältnismäßig wäre.

### Architektur
Zwei getrennte Flows mit gemeinsamem Parser-Kern:
1. **Organisator-Flow (MVP):** Matchup-Seite → Datei-Upload mit **rohem Binary-Body** (`Content-Type: application/octet-stream`, Body = `file` direkt als Fetch-Body) statt multipart/form-data — die Matchup-ID steht in der URL, es gibt keine weiteren Formularfelder, daher kein Bedarf für Multipart; Client sendet einfach `fetch(url, { method: 'POST', body: file })`, Server liest den Body direkt als `ArrayBuffer` (kein zusätzliches Multipart-Parsing-Package nötig) → Backend nimmt die Datei temporär entgegen, legt Replay-Datensatz mit Status `pending` an → asynchrone Verarbeitung im Hintergrund (Mechanismus laut Spike) → Status wechselt zu `done`/`failed`, Ergebnisfelder werden befüllt → Rohdatei wird verworfen → Matchup referenziert die Replay-ID

   **Endpoint-Namespace:** Das Konzept nannte ursprünglich `POST /api/matchups/:id/replay` — einen solchen Top-Level-Namespace gibt es aber nicht; Matchups leben unterhalb eines Gamedays/Turniers. Der Upload-Endpoint wird deshalb an die bestehende, JWT-geschützte Struktur angeglichen (z.B. `POST /api/gamedays/:id/matchups/:matchupId/replay` bzw. das Turnier-Pendant), damit er konsistent unter der geschützten Route liegt und die Zugehörigkeit zum Turnier eindeutig ist.

   **Autorisierung & Limits:**
   - Nur der **Turnier-Owner** (siehe Turniermodus-Konzept, Owner-Modell) darf zu einem Matchup ein Replay hochladen — der Endpoint erbt die Owner-Prüfung der turnierverändernden Routes.
   - **Größen-Limit:** SC2-Replays sind klein (typisch < ~5 MB). Der Endpoint erzwingt eine harte Obergrenze (Vorschlag ~10 MB) und lehnt größere Bodies ab, bevor sie vollständig gelesen/verarbeitet werden — wichtig, weil ein roher octet-stream-Endpoint sonst offen für große Uploads wäre.
   - **Rate-Limit:** einfaches Limit pro User/Matchup gegen versehentliches oder böswilliges Mehrfach-Hochladen.
2. **Status-Updates per SSE statt Polling:** Der Replay-Verarbeitungsstatus (`pending → done/failed`) wird über den generischen SSE-Kanal aus dem gemeinsamen Fundament (`shared-foundation.md`) gepusht — das Frontend öffnet eine Server-Sent-Events-Verbindung für das Turnier/den Gameday und aktualisiert den Status ohne Polling. Der Kanal ist bewusst nicht replay-spezifisch (Standings-/Matchup-Änderungen laufen ebenfalls darüber); Replay-Status ist nur einer der Event-Typen. Dieses Feature konsumiert den Kanal, definiert ihn aber nicht — er wird im Fundament einmal gebaut.
3. **User-Flow (später):** vollständig clientseitig — Datei → `file.arrayBuffer()` → WASM-`parse`-Funktion → Ergebnis direkt im Browser, keine Backend-Interaktion nötig

**Sieger-Zuordnung (zwei unabhängige Achsen):** Ob aus einem verarbeiteten Replay der Matchup-Sieger *automatisch* gesetzt wird, hängt an zwei Bedingungen, die beide erfüllt sein müssen:
1. **Sieger im Replay erkennbar** — abhängig vom Spike-Ergebnis (Ableitung aus Tracker-Events). Gelingt das nicht zuverlässig, gibt es keinen Vorschlag und der Sieger ist immer manuell.
2. **Replay-Spieler → Discord-Identität zuordenbar** — der siegreiche Replay-Spieler (Toon-Handle) muss über eine Battle.net↔Discord-Verknüpfung eindeutig einem der beiden angemeldeten Matchup-Teilnehmer entsprechen.

Entscheidungslogik:
- **Beide Achsen eindeutig** → Matchup-Sieger wird automatisch gesetzt (mit sichtbarem Hinweis "aus Replay").
- **Sieger erkannt, aber Zuordnung nicht möglich** (kein/mehrdeutiges Battle.net-Match) → erkannter Sieger wird als **Vorschlag** angezeigt; Organisator bestätigt/setzt manuell.
- **Sieger nicht erkennbar** → nur Metadaten gespeichert; Organisator setzt den Sieger manuell.

**Autorität bei Konflikt (Organisator schlägt Replay):** Der offizielle Matchup-Sieger liegt immer in der Hoheit des Organisators. Die Automatik setzt den Sieger nur, wenn **noch keiner** gesetzt ist. Ist bereits ein Sieger gesetzt und ein danach hochgeladenes Replay weicht ab, wird der bestehende Sieger **nicht** automatisch überschrieben — die App zeigt eine deutliche Diskrepanz-Warnung ("Replay sagt X, gesetzt ist Y") und der Organisator entscheidet aktiv, ob er korrigiert. Damit ist die Quelle konsistent: Replay liefert Beleg und Vorschlag, die Entscheidung bleibt beim Organisator.

In allen Fällen bleiben die extrahierten Metadaten (Spieler, Map, Dauer, Rassen) am Replay gespeichert und mit dem Matchup verknüpft.

**Was die "Verifizierung" leistet — und was nicht:** Das Feature verifiziert, *wer innerhalb des hochgeladenen Replays gespielt und gewonnen hat*, und (mit Battle.net-Verknüpfung) *dass diese Spieler den angemeldeten Teilnehmern entsprechen*. Es beweist **nicht**, dass das Replay genau das Spiel *dieses* Matchups ist — ein Organisator könnte (versehentlich oder absichtlich) ein anderes Spiel derselben zwei Spieler hochladen. Das Feature reduziert also Selbstauskunft-Fehler und Tippfehler und liefert einen objektiven Beleg, ist aber kein manipulationssicherer Nachweis. Die optionale Map-Verifizierung (Nice-to-Have: gespielte Map vs. Veto-Ergebnis) engt diese Lücke weiter ein, schließt sie aber nicht vollständig. Die finale Hoheit über das offizielle Ergebnis bleibt bewusst beim Organisator.

### Risiken
- **Spike-Abhängigkeit:** Parse-Dauer, Sieger-Erkennungslogik und Wiederverwendbarkeit des Parser-Kerns client-/serverseitig sind unbekannt — alle nachgelagerten Stories sind bis dahin vorläufig.
- **Neue Backend-Infrastruktur nötig:** Datei-Empfang und Hintergrundverarbeitung existieren aktuell überhaupt nicht im Stack (nur Hono + SurrealDB) — größerer Aufwand als ein rein clientseitiger Ansatz, aber für den Organisator-Anwendungsfall (nicht warten müssen) die passendere UX.
- **Durability der Hintergrundverarbeitung (nach Spike zu entscheiden):** Ein einfacher In-Process-async-Task hat zwei bekannte Failure-Modes, die im MVP bewusst adressiert werden müssen:
  - *Hängende `pending`-Einträge:* Stirbt der Prozess (Neustart/Absturz/Crash beim Parsen) während der Verarbeitung, bleibt das Replay ohne Gegenmaßnahme dauerhaft auf `pending`. Minimal-Absicherung unabhängig von der Queue-Frage: ein Timeout/Recovery, der überfällige `pending`-Einträge auf `failed` setzt, sodass ein Re-Upload möglich ist.
  - *Single-Instance-Bindung:* Ein In-Memory-Task und ein In-Memory-SSE-Broadcast funktionieren nur bei genau einer API-Instanz. Solange die API single-instance läuft, ist das ok — das ist eine bewusste MVP-Annahme und muss dokumentiert bleiben; horizontale Skalierung würde eine durable Queue + instanzübergreifendes Event-Fan-out erfordern.
  - Ob es beim einfachen Task + Recovery bleibt oder eine persistente Job-Queue kommt, entscheidet der Spike anhand der oben genannten Kriterien.
- **Neue Toolchain im Monorepo (entschärft):** Rust + `wasm-pack` sind bisher nicht Teil des Bun/TS-Stacks. Da das WASM-Artefakt plattformunabhängig ist und selten neu gebaut werden muss, wird es vorkompiliert eingecheckt (siehe Toolchain-Strategie) — normale Contributor und der Standard-Build brauchen kein Rust. Restrisiko: eingecheckte Build-Artefakte müssen bei Parser-Änderungen konsistent mit-aktualisiert werden (Disziplin/CI-Check nötig, damit Artefakt und Quelle nicht auseinanderlaufen).
- **Zweiter OAuth-Flow (Battle.net):** Neben dem bestehenden Discord-Login kommt ein Battle.net-OAuth hinzu (App-Registrierung bei Blizzard, zusätzliche Secrets/Redirects, Konto-Verknüpfungs-UI und -Zustand am User). Vergrößert den MVP-Scope und die Auth-Komplexität. Randfälle: Toon-Handle ändert sich, mehrere Battle.net-Accounts, Replay-Name ohne verknüpften User — führen sauber zum manuellen Fallback, müssen aber bedacht werden.
- **Sieger-Zuordnung bleibt nur so gut wie die Verknüpfungsdaten:** Auto-Zuordnung greift nur, wenn beide Teilnehmer ihr Battle.net-Konto verknüpft haben und die Handles eindeutig sind — realistisch wird der manuelle Fallback im MVP häufig gebraucht.
- **SSR-Kompatibilität (User-Flow):** WASM-Modul darf nicht versehentlich serverseitig gebündelt werden (Nitro-Preset `bun`) — Client-only-Ladepfad nötig.
- **Schema-Abstimmung über das gemeinsame Fundament:** Das Sieger-/Ergebnis-Konzept am Matchup (`winner`/`score` + `replayId`-Referenz) ist im gemeinsamen Fundament (`shared-foundation.md`) definiert; dieses Feature schreibt hinein bzw. liefert einen Vorschlag, definiert es aber nicht selbst.
- **SSE als geteilte Infrastruktur:** Der Live-Update-Kanal ist Teil des gemeinsamen Fundaments (`shared-foundation.md`) und bewusst generisch (Standings-/Matchup-Änderungen *und* Replay-Status). Er wird dort einmal definiert, statt hier eine replay-eigene Lösung zu bauen — Verbindungsmanagement/Reconnect fallen einmalig an und kommen beiden Features zugute.

## Offene Fragen
Keine offenen Produktentscheidungen — die verbleibenden Unsicherheiten (Parse-Dauer, Sieger-Logik, Bundle-Größe, Wiederverwendbarkeit des Parser-Kerns) sind bewusst als **Spike** vor der eigentlichen Umsetzung eingeplant, nicht als offene Fragen im Konzept selbst.
