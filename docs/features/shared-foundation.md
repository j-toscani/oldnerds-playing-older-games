# Feature: Gemeinsames Fundament — Matchup-Ergebnis & Live-Updates

## Zusammenfassung
Zwei Bausteine, die sowohl der **Turniermodus** (`feature-concept.md`) als auch der **Replay-Upload** (`replay-upload.md`) brauchen und die deshalb *einmal, vorgelagert* definiert werden, statt in beiden Features getrennt zu entstehen:

1. **Matchup-Ergebnis-Modell** — ein einheitliches Sieger-/Ergebnis-Feld am Matchup, auf dem beide Features aufsetzen.
2. **Live-Update-Kanal (SSE)** — ein generischer Server-Sent-Events-Kanal pro Turnier/Gameday, über den Standings-Änderungen, neue/aktualisierte Matchups und Replay-Verarbeitungsstatus an alle Zuschauer/Teilnehmer gepusht werden.

Ziel: Verhindern, dass zwei separate Ergebnis-Konzepte oder zwei parallele Live-Update-Lösungen entstehen.

## Motivation / Problem
Beide Feature-Konzepte haben unabhängig dieselben Lücken bzw. Bedürfnisse identifiziert:
- Der heutige `Matchup`-Typ hat **kein Ergebnis-Feld** (nur `active`). Turniermodus braucht es für Standings/Advancement, Replay-Upload braucht es, um einen (erkannten oder manuell gesetzten) Sieger zu hinterlegen.
- Beide brauchen **Live-Updates ohne Polling**: Turniermodus für Standings/Matchup-Änderungen, Replay-Upload für den `pending → done/failed`-Verarbeitungsstatus.

Ohne gemeinsame Definition würden diese Bausteine doppelt und potenziell inkonsistent gebaut.

## Reihenfolge / Abhängigkeit (wichtig)
- Der **Turniermodus** definiert das Matchup-Ergebnis-Feld (als Teil der Modellerweiterung Gameday → Tournament) und ist damit der natürliche Ort, an dem dieses Fundament zuerst entsteht.
- Der **Replay-Upload** ist **hart abhängig** von diesem Ergebnis-Feld: Er kann einen Sieger erst hinterlegen/vorschlagen, wenn das Feld existiert. Replay-Upload darf daher nicht vor dem Ergebnis-Feld begonnen werden.
- Der **SSE-Kanal** ist von beiden nutzbar; er sollte generisch (nicht replay- oder standings-spezifisch) gebaut werden, damit beide Feature-Event-Typen darüber laufen.

## Scope

### MVP (Must-Have)
- **Matchup-Ergebnis am Datenmodell**: `Matchup` (bzw. `MatchupWithState`) bekommt ein Ergebnis — mindestens `winner` (Referenz auf einen der beiden Teilnehmer-Slots), optional `score`. Quelle des Ergebnisses (manuell gesetzt vs. aus Replay) wird so modelliert, dass beide Features damit arbeiten können (z.B. `winner` + optionale `replayId`-Referenz; das offizielle Ergebnis bleibt `winner`).
- **Generischer SSE-Endpoint** pro Turnier/Gameday (z.B. `GET /api/gamedays/:id/events`), der typisierte Events pusht (`standings-updated`, `matchup-updated`, `replay-status`, …). Frontend hält eine Verbindung offen und aktualisiert die Ansicht, statt zu pollen.
- **Konsistente Event-Struktur**: ein gemeinsames Event-Envelope-Format (Typ + Payload), damit neue Event-Typen additiv ergänzt werden können.

### Out-of-Scope
- Instanzübergreifendes Event-Fan-out / horizontale Skalierung des SSE-Kanals (MVP nimmt Single-Instance-Betrieb an — siehe Durability-Diskussion in `replay-upload.md`).
- WebSockets / bidirektionale Kommunikation (SSE genügt für reine Server→Client-Updates).

## Technisches Konzept

### Betroffene Bereiche
- `packages/shared/src/types.ts` — `Matchup`/`MatchupWithState` um Ergebnis (`winner`, optional `score`, optional `replayId`) erweitern; Event-Typen für den SSE-Kanal definieren.
- `apps/api/src/models/` — Ergebnis-Felder im Matchup-Schema (Teil der Turniermodus-Modellerweiterung).
- `apps/api/src/routes/` — neuer SSE-Endpoint; Broadcast-Mechanismus, den sowohl Ergebnis-/Standings-Änderungen als auch die Replay-Verarbeitung auslösen.
- `apps/website/` — SSE-Client (Verbindungsaufbau, Reconnect), der von Turnier-Ansicht (Standings/Matchups) und Matchup-Seite (Replay-Status) gemeinsam genutzt wird.

### Architektur
- **Ergebnis am Matchup** ist die *einzige Quelle der Wahrheit* für „wer hat das Matchup gewonnen". Der Turniermodus liest daraus Standings/Advancement; der Replay-Upload schreibt (bei eindeutiger Erkennung + Zuordnung) hinein bzw. liefert einen Vorschlag. Die Autorität-bei-Konflikt-Regel ist im Replay-Konzept festgelegt (Organisator schlägt Replay; Automatik setzt nur, wenn noch kein Sieger existiert).
- **SSE als generischer Kanal**: Ein Event-Envelope (`{ type, payload }`) transportiert unterschiedliche Event-Typen. Verbindungsmanagement (offene Clients pro Turnier, Reconnect-Verhalten) wird einmal gelöst. Der Replay-Status ist nur einer von mehreren Event-Typen.

### Risiken
- **SSE-Verbindungsmanagement**: offene Verbindungen, Reconnect, wer welche Events empfängt — moderater Aufwand, der aber einmalig anfällt und beiden Features zugutekommt.
- **Single-Instance-Annahme**: In-Memory-Broadcast funktioniert nur bei einer API-Instanz; horizontale Skalierung ist bewusst Out-of-Scope und muss als MVP-Grenze dokumentiert bleiben.
- **Kopplung der Roadmaps**: Weil Replay-Upload hart vom Ergebnis-Feld abhängt, muss die Umsetzungsreihenfolge (erst Fundament/Turniermodus-Ergebnisfeld, dann Replay-Sieger-Logik) eingehalten werden.

## Offene Fragen
- **Envelope-/Event-Typen im Detail**: Die konkrete Liste der Event-Typen und ihr Payload-Schema werden mit der Umsetzung der beiden Features geschärft; das Fundament legt nur das gemeinsame Format und den Kanal fest.

## Umsetzungsstand (MVP, Epic #40)
Das Fundament ist umgesetzt:

- **Ergebnis-Modell (#43):** `MatchupWithState` in `packages/shared/src/types.ts` um `winner?: MatchupSlot` (`'player1' | 'player2'`, offizielle Quelle der Wahrheit), optionales `score` und optionales `replayId` erweitert. SurrealDB-Schema in `apps/api/src/models/gameday.ts` entsprechend erweitert (`option<string>`-Felder, `winner`-ASSERT auf die zwei Slots); der Model-Writer sanitized fehlende Optionals zu NONE.
- **SSE-Kanal (#44):** Purer, transport-agnostischer Pub/Sub-Hub `apps/api/src/lib/events.ts` (`subscribe`/`broadcast`) + SSE-Lifecycle-Helper `apps/api/src/lib/sse.ts` (`openGamedayStream` — subscribe, Heartbeat-Kommentare, Cleanup bei Abbruch); Endpoint `GET /api/gamedays/:id/events` (`streamSSE`) bleibt ein Einzeiler. Der Event-Typ steht im nativen SSE-`event:`-Feld, der Payload als JSON im `data:`-Feld (logisch das Envelope `GamedayEvent = { type, payload }` in `packages/shared`). `PUT /api/gamedays/:id` broadcastet `matchup-updated` + `standings-updated`.
- **Frontend (#45):** Hook `apps/website/src/lib/useGamedayEvents.ts` (EventSource, ein nativer `addEventListener` je Handler-Key, Reconnect mit gedeckeltem Backoff) und Live-Route `gameday.$id.tsx`, die nach dem Initial-Load ausschließlich per SSE aktualisiert (kein Polling). Der Initial-Load läuft über den typisierten Hono-RPC-Client `apps/website/src/lib/api.ts` (`hc<AppType>`, type-only Ableitung aus `@onog/api`), nicht über handgeschriebenes `fetch`.

Event-Typen bleiben additiv erweiterbar (`replay-status` ist bereits als Typ reserviert, wird aber erst mit dem Replay-Upload befüllt).
