 # Konzept: SC2-Datenregister (im Monorepo)

  > **Kein Teil von [`replay-library-local.md`](./replay-library-local.md).** Dieses Dokument hält
  > Rechercheergebnisse und Ideen für ein **Datenregister innerhalb dieses Monorepos** fest. Es
  > blockiert nichts am laufenden Replay-Feature.

  > **Update 2026-10-24:** Not needed for tracker-event analyses. Tracker events already carry
  > resolved unit and ability names (`"Pylon"`, `"GatewayTrain"`), so build orders, economy, supply
  > and unit counts work without this registry (see
  > [`replay-analysis-research.md`](./replay-analysis-research.md)). It only becomes necessary for
  > **game events** (`abil_link` mapping per build) or for exact unit stats across many patches.

  > **Revision 2026-11-13:** Die ursprüngliche Fassung sah ein **eigenes Repository** vor — verworfen,
  > siehe [Warum Monorepo statt eigenem Repo](#warum-monorepo-statt-eigenem-repo). Neu: der
  > Discord-gestützte Beitragsweg (Erinnerung + Upload) und die daraus folgenden Pipeline- und
  > Sicherheitsentscheidungen. Der Befund vom 24.10. bleibt unverändert gültig und bestimmt die
  > [Umsetzungsreihenfolge](#umsetzungsreihenfolge): **Schritt 0 ist zu entscheiden, ob wir das
  > Register überhaupt brauchen.**

  ## Status in einem Satz
  Ein fertig durchdachtes, **noch nicht benötigtes** Feature. Es wird erst relevant, wenn wir Game
  Events auswerten oder Einheiten-Stats und Icons anzeigen wollen — bis dahin ist dieses Dokument
  ein Bauplan auf Vorrat, kein Backlog-Eintrag.

  ## Zusammenfassung
  Ein Workspace-Package `@onog/balance-data` hält SC2-Stammdaten **pro Spiel-Patch** vor. Weil der
  Export aus dem SC2-Editor einen Menschen an einem Windows-Rechner braucht, besteht das Feature
  aus zwei Hälften:

  1. **Eine Erinnerung, die sich selbst abschaltet.** Ein täglicher GitHub-Actions-Cron vergleicht
     den neuesten `base_build` bei Blizzard mit dem, was im Repo liegt. Fehlt einer, geht eine
     Nachricht in den Discord-Server — und zwar so lange, bis die Daten da sind.
  2. **Ein Upload, der dort stattfindet, wo die Erinnerung ankommt.** `/balance-data upload`
     nimmt das ZIP des Editor-Exports als Discord-Attachment entgegen; der Rest — Entpacken,
     Konvertieren, Bündeln, Committen, Release — läuft in GitHub Actions.

  Beitragen heißt damit: *Editor öffnen, exportieren, zippen, in Discord ziehen.* Kein Git, kein
  Checkout, kein Branch — und damit kann es **jede Person im Server mit installiertem Spiel**, nicht
  nur der Repo-Owner.

  ## Motivation / Problem

  ### Wofür wir das Register **nicht** brauchen — verifiziert
  Der Parser liest heute `details` und **Tracker Events**
  (`packages/replay-parser/src/lib.rs:173-176`). Deren Felder sind laut
  [`replay-analysis-research.md`](./replay-analysis-research.md) **bereits aufgelöste Strings**:
  `unit_type_name` liefert `"Pylon"`, `"Stalker"`, dazu `creator_ability_name`. Build-Order,
  Ökonomie, Supply und Unit-Counts brauchen deshalb **kein** Datenregister.

  ### Wofür wir es bräuchten
  Nur zwei Dinge liegen jenseits dieser Grenze:

  - **Game Events.** Dort steht keine Zeichenkette, sondern ein numerischer `abil_link` —
    sinngemäß „Spieler 1 nutzte Ability-Index 41 an Einheit-Typ 71". Diese Zuordnung ändert sich
    **mit dem Patch**, es gibt also nicht *ein* Wörterbuch, sondern eines pro `base_build`. Game
    Events sind das, was Tracker Events nicht hergeben: Hotkeys, Kommandos, Mikro, das Timing von
    Befehlen statt der Ergebnisse.
  - **Stats und Icons.** Kosten, Leben, Rüstung, Schaden, Stärken/Schwächen, Einheitenbilder — alles,
    was eine Anzeige schön macht und keine Analyse braucht.

  Die Recherche zeigt: **Es existiert keine verlässliche, gepflegte Quelle dafür.** Alle gefundenen
  Projekte sind manuell gepflegt und veraltet oder eingeschlafen. Wer diese Auflösung will, muss die
  Datenlieferkette selbst betreiben.

  ### Das eigentliche Problem ist Vergessen, nicht Technik
  `SC2Mapster/SC2GameData` hatte **genau die Automatisierung, die wir bauen würden** — jahrelange
  Bot-Commits im Muster `SC2 5.0.16.97364`. Am 29.06.2026 hat der Maintainer von Hand den Hinweis
  nachgeschoben, dass Tooling und Automation kaputt sind. Der Bot ist nicht am JSON gescheitert,
  sondern an der Beschaffung — und niemandem fiel monatelang auf, dass nichts mehr nachkam.

  Daraus folgt die Leitidee dieses Konzepts: **Die Konvertierung zu automatisieren ist das leichte
  Problem. Dafür zu sorgen, dass ein Mensch rechtzeitig merkt, dass er dran ist, ist das schwere.**
  Deshalb wäre die Erinnerungsschleife kein Nice-to-have, sondern Teil des MVP.

  ## Zielgruppe
  - **Wir selbst**, sobald eine Analyse Game Events oder Stats braucht
  - **Die Community im Discord-Server** als Beitragende — der Upload-Weg senkt den Bus-Faktor von 1
    auf *jeder mit installiertem Spiel*
  - **Andere SC2-Tool-Entwickler**, falls wir die Releases öffentlich lassen — die Lücke ist real und
    unbesetzt. Das README von `s2protocol-rs` führt den Bedarf selbst als TODO:
    *„The json exports from BalanceData could be loaded from a remote repo (github maybe?),
    otherwise people need to have this repo cloned."*

  ## Rechercheergebnisse

  ### Woher die Daten stammen — belegt
  Quelle ist der **SC2-Editor selbst**: `File > Export Balance Data`, eingeführt mit Patch 2.0.10
  (2013). Originalwortlaut der Patchnotes:

  > „Added File > Export Balance Data functionality. These commands will download the latest
  > balance data from Battle.net and export them to **web-friendly XML and image files**."

  Der Export erzeugt ~1.000–1.600 XML-Dateien (eine pro Einheit/Gebäude) plus Icons. Das ist genau
  das Format, das `s2protocol-rs` nach JSON konvertiert.

  **Es gibt keine offizielle API dafür.** Die Battle.net Game Data API für SC2 liefert
  ausschließlich Ladder-, League- und Profildaten — keine Unit-/Ability-Stammdaten. Ein
  öffentlicher HTTP-Endpunkt, von dem der Editor seine Daten zieht, ist nicht dokumentiert.

  ### Vorhandene Quellen und ihr Zustand (Stand 2026-09-12)

  | Quelle | Inhalt | Stand | Pflege | Lizenz |
  |---|---|---|---|---|
  | [`Blizzard/s2client-proto`](https://github.com/Blizzard/s2client-proto) | `stableid.json` (796 KB): IDs → Namen | 07/2026, bis Build **97563** | **offiziell, aktiv** | MIT |
  | [`HADB/sc2-balance-data`](https://github.com/HADB/sc2-balance-data) | Editor-XML, exakt unser Format | 07/2026, Builds 96883–97425 | manuell (`Bean`), alle Commits an einem Tag nachgetragen | **keine** ⚠️ |
  | [`SC2Mapster/SC2GameData`](https://github.com/SC2Mapster/SC2GameData) | rohe GameData-XML | 06/2026, bis 97364 | **war automatisiert** (Bot `Talvbot`), README: *„no longer receiving active updates, tooling and automation is broken"* | keine |
  | [`Ahli/sc2xml`](https://github.com/Ahli/sc2xml) | rohe GameData-XML | 10/2025, bis 95162 | manuell, schubweise | keine |

  Kein einziges Projekt hat GitHub Actions.

  ### `stableid.json` als möglicher Abkürzungsweg
  Die offizielle, MIT-lizenzierte Datei ist **kein reiner Versionshinweis**:

  | Kategorie | Einträge | Beispiel |
  |---|---|---|
  | `Abilities` | 3.797 | `{"id": 0, "index": 255, "name": "Null", "buttonname": "Null"}` |
  | `Units` | 1.943 | `{"id": 0, "name": "NotAUnit"}` |
  | `Upgrades` | 296 | |
  | `Buffs` / `Effects` | 289 / 13 | |

  Für den **Game-Events-Fall** — den einzigen, in dem uns Namen noch fehlen — könnte das reichen: Es
  ist eine ID→Name-Tabelle aus offizieller, aktiv gepflegter Quelle, und sie wäre ohne jede eigene
  Lieferkette zu haben.

  Zwei ungeprüfte Haken: `stableid.json` liegt nur in der **jeweils aktuellen** Fassung im
  Master-Branch — ältere Builds müssten über die Git-Historie geholt werden (automatisierbar). Und
  `s2client-proto` zielt auf die **Bot-API**, deren IDs nicht zwangsläufig identisch mit den
  `abil_link`-Werten in Replays sind. Das ist an einem echten Replay zu verifizieren, **bevor**
  irgendetwas aus diesem Konzept gebaut wird.

  ### Der Konverter — am Fork verifiziert (2026-11-13)
  Geprüft am ausgecheckten Stand unseres Forks (`j-toscani/s2protocol-rs`, rev `cdf742e`):

  - **Der Konverter ist ein `example`, kein `bin`:**
    `cargo run --example full -r -- --source <xml-root> --json-balance-data-dir <json-dir> --output <out> balance-data-to-json`
  - **Erwartetes Eingabe-Layout:** `<xml-root>/<base_build>/BalanceData/<Unit>.xml` — die
    Build-Nummer ist Teil des Pfades, nicht des Dateiinhalts. Sie muss also von außen kommen und
    kann nicht aus dem ZIP abgeleitet werden.
  - **Ausgabe ist eine Datei pro Einheit**, pretty-printed: `write_balance_data_to_json` schreibt
    nach `<out>/<version>/<unit_name>.json` via `serde_json::to_writer_pretty`. Die Bündelung zu
    einer Datei ist also **unsere** Nachbearbeitung, kein Schalter am Crate.
  - **Der Konverter liest vorhandenes JSON ein und mischt.** Im README-Log des Autors:
    *„Read 7406 versioned balance units from JSON files … Processed 7320 total units"* bei ~55 s
    Laufzeit. In CI wollen wir das nicht — `--json-balance-data-dir` zeigt bei uns auf ein leeres
    Verzeichnis, damit nur der neue Build verarbeitet wird.
  - **Feature-Lage:** `default = ["dep_arrow", "tracing_info_level", "included_assets"]`.
    `included_assets` bettet ~53 MB BalanceData ins Binary — für die Konvertierung sinnlos.
    **Ungeprüft:** ob das `full`-Example mit `--no-default-features` baut. Falls nicht, ist das
    hinnehmbar (die CI baut nativ, nicht für wasm) und kostet nur Build-Zeit.

  ### Fehlverhalten bei fehlendem Build — belegt
  Aus dem Fork-README: *„If the XMLs/JSON for a specific version doesn't exist, all ability Strings
  will appear as `""`."* Der Crate meldet also **keinen Fehler**, sondern liefert leere Strings.
  Das macht unsere Fallback-Regel zur Pflicht: Ohne sie zeigt die UI an jedem Patchtag
  stillschweigend leere Felder, statt „approximiert" zu melden.

  ### Discord-Plattformfakten — aus den aktuellen API-Docs geprüft (2026-11-13)
  - **`ATTACHMENT` ist Option-Type `11`** in der Application-Command-Option-Tabelle. Ein Datei-Upload
    ist damit eine ganz normale Slash-Command-Option.
  - **Upload-Limit: 20 MiB pro Attachment** (Default; höher bei Nitro bzw. Server-Boost). Die
    Interaction liefert den konkreten Wert als `attachment_size_limit` mit. Der Roh-Export misst
    5,3 MB über 1.063 Dateien — gezippt unkritisch.
  - **Attachment-CDN-URLs sind signiert und laufen ab.** Sie tragen `ex` (Ablauf), `is` (Ausstellung)
    und `hm` (Signatur) im Query-String; nur die *statischen* CDN-Endpunkte sind unsigniert.
    → **Die URL darf nicht gespeichert und später verarbeitet werden.** Der Bot muss sofort
    weiterreichen.

  ### Größenmessungen (Build 97563, 1.063 Einheiten)

  | Variante | Größe | gzip |
  |---|---|---|
  | Wie im Crate: 1.063 Einzeldateien auf der Platte | 5,3 MB | — |
  | Ein Build, alle Einheiten **gebündelt** (minified) | 1,53 MB | **110 KB** |
  | Nur `id → name/race/icon/index` („schlank") | 86 KB | **16 KB** |

  Die 5,3 MB sind überwiegend Dateisystem-Overhead und Formatierung. **Hosting ist damit kein
  Kostenfaktor.**

  ## Warum Monorepo statt eigenem Repo

  Das ursprüngliche Argument für ein eigenes Repository war die **Auslieferung an Dritte**. Das
  trägt nicht: Der Konsument ist unsere Website, und die kann die schlanke Datei schlicht
  mitbündeln. Was ein eigenes Repo kostet, ist dagegen real — ein zweiter Ort mit eigenen Secrets,
  eigener CI, eigenem Dependabot und eigener Vergessens-Wahrscheinlichkeit. Für ein Feature mit
  ~8 Ereignissen im Jahr ist das die teurere Hälfte.

  Was das Monorepo **nicht** mitbringt, ist die Isolation, die ein eigenes Repo geschenkt hätte.
  Vier Konsequenzen, die vor der Umsetzung geklärt sein müssen:

  ### 1. Keine XML im Git
  1.063 Dateien pro Build, ~8 Builds im Jahr → nach zwei Jahren ~17.000 Dateien, die jedes `rg`,
  jeden Editor-Index und jeden CI-Checkout belasten. Das Problem sind nicht die Bytes, sondern die
  Dateianzahl in einem ansonsten schlanken App-Repo.

  **Entscheidung:** Das hochgeladene **XML-ZIP wird Release-Asset**, nicht Repo-Inhalt. Ins Git
  kommt nur das generierte JSON. Der ursprünglich genannte Grund für XML-im-Repo — *„diffbar,
  Balance-Änderungen zwischen Patches als Git-Diff sichtbar"* — wird vom **gebündelten JSON besser
  erfüllt** als von 1.063 Einzeldateien, die niemand nebeneinanderlegt. Reproduzierbarkeit bleibt
  über das Release-Asset erhalten, und anders als eine Discord-URL läuft ein Release-Asset nicht ab.

  ### 2. Tag-Namensraum trennen
  `build_push_and_deploy.yml` triggert auf `tags: ['v*.*.*']`. Ein Balance-Tag muss also einem
  anderen Muster folgen: **`balance-<base_build>`**, z.B. `balance-97563`. Damit löst ein
  Daten-Release keinen Image-Build aus.

  ### 3. ⚠️ `tag_release.yml` würde bei jedem Patch die App deployen
  Der wichtigste Fund dieser Revision. `tag_release.yml` triggert auf **jeden Push nach `main`** und
  überspringt nur Commits, deren Message mit `chore(release):` beginnt:

  ```yaml
  on:
    push:
      branches: [main]
  jobs:
    tag:
      if: "!startsWith(github.event.head_commit.message, 'chore(release):')"
  ```

  Ein Balance-Daten-Commit auf `main` würde also einen **Versions-Bump + Release-Tag** auslösen,
  und der Tag wiederum `build_push_and_deploy.yml`. Ergebnis: **Ein neuer SC2-Patch deployt die
  App.** Das ist kein theoretisches Risiko, sondern das Default-Verhalten.

  **Entscheidung:** `tag_release.yml` bekommt ein `paths-ignore` auf das Datenverzeichnis. Ein
  reiner Daten-Commit bumpt die App-Version nicht. Das ist konsistent mit der hybriden Auslieferung
  (siehe unten): Neue Builds erreichen die App zur Laufzeit, ein Redeploy ist dafür nicht nötig.

  ### 4. Pfadfilter sind Pflicht, nicht Kür
  Der Präzedenzfall steht schon im Repo — `replay_parser.yml`:

  > „Deliberately path-filtered: the WASM artifact in `packages/replay-parser/pkg` is checked in, so
  > the Rust toolchain stays out of the normal build. Only changes to the crate itself rebuild and
  > re-test it."

  Dieselbe Disziplin gilt hier. Im eigenen Repo wäre die Stufen-Entkopplung geschenkt gewesen; im
  Monorepo muss sie per `paths:` erzwungen werden — sonst kippt ein kaputter Balance-Job die
  App-CI. Das Muster existiert bereits, wir folgen ihm nur.

  ## Scope

  ### MVP
  - **Workspace-Package `@onog/balance-data`** mit den generierten JSON-Daten pro `base_build`
  - **Erinnerungs-Pipeline:** täglicher Cron, der fehlende Builds erkennt und in Discord meldet —
    selbstlöschend, ohne Zustandsdatei
  - **Upload-Pipeline:** `/balance-data upload` (Discord-Attachment) → `repository_dispatch` →
    Konvertierung in Actions → Commit + Release
  - **Fallback-Auflösung** im Package: exakter Build, sonst nächstniedrigerer, markiert als
    `approximated`
  - **Workflow-Absicherung:** `paths`-Filter auf dem neuen Job, `paths-ignore` auf `tag_release.yml`,
    eigener Tag-Namensraum

  ### Erweiterungen
  - **`stableid.json` mitausliefern** — pro Build aus der Git-Historie von `s2client-proto` gezogen
  - **Diff-Ansicht:** Balance-Änderungen zwischen zwei Builds als lesbare Liste
  - **Icons** aus dem Editor-Export (DDS → WebP in der Pipeline), sobald eine UI sie braucht
  - **`/balance-data status`** — welche Builds liegen vor, welcher fehlt
  - npm-Package als zusätzlicher Auslieferungsweg, falls die Daten extern nachgefragt werden

  ### Out-of-Scope
  - **Automatischer Datenexport ohne Menschen.** Eine SC2-Installation dauerhaft laufen zu lassen
    ist nicht gegeben; Headless-Export ist unbelegt (siehe Risiken)
  - Eigener Auflösungs-Layer für rohe CASC-GameData (Mod-Vererbung core → liberty → swarm → void)
  - Historische Builds nachpflegen — wir starten beim aktuellen und wachsen vorwärts

  ## Technisches Konzept

  ### Architektur
  ```
     [Blizzard/s2client-proto]
              |  taeglicher Cron: neuester base_build?
              v
     .github/workflows/balance_data_reminder.yml
              |  Build fehlt im Repo?
              v
     Discord-Channel  <-- Webhook-POST ("Build 97563 fehlt, bitte /balance-data upload")
              |
              |  Mensch: SC2-Editor -> File > Export Balance Data -> ZIP
              v
     /balance-data upload build:97563 file:<zip>    (Slash-Command, Option-Type 11)
              |
              v
     apps/bot  --- repository_dispatch {build, attachment_url} --->  GitHub
                   (CDN-URL laeuft ab: sofort weiterreichen,           |
                    niemals zwischenspeichern)                         v
                                            .github/workflows/balance_data_ingest.yml
                                                                       |
                                        +------------------------------+
                                        |  1. ZIP laden (URL noch gueltig) + validieren
                                        |  2. s2protocol-rs: balance-data-to-json
                                        |  3. 1.063 Dateien -> bundle.json + slim.json
                                        v
     packages/balance-data/builds/97563/{bundle,slim}.json   -> Commit auf main
     Release "balance-97563"                                 -> XML-ZIP als Asset
  ```

  ### Ablage im Monorepo
  ```
  packages/balance-data/
    package.json                 @onog/balance-data (private, kein Build-Step)
    src/
      index.ts                   resolveBuild() mit Fallback-Regel
      types.ts                   BalanceUnit, SlimEntry, ResolvedBuild
    builds/
      97563/
        bundle.json              pretty-printed, diffbar
        slim.json                minified, von der App gebuendelt (86 KB)
    scripts/
      bundle.mts                 1.063 Einzeldateien -> bundle.json + slim.json
  ```

  Konsumiert wird wie `@onog/shared`: **als TypeScript-Source über `workspace:*`**, ohne Build-Step
  und ohne DB-Dependency.

  **Zur Formatierung:** `bundle.json` wird pretty-printed abgelegt, damit Patch-zu-Patch-Diffs
  zeilenweise lesbar sind; `slim.json` minified, weil sie ins App-Bundle geht. Pretty-printed ist
  roh größer, lässt sich aber über Builds hinweg gut delta-komprimieren, da die meisten Einheiten
  zwischen zwei Patches unverändert bleiben. **Ungeprüft:** der tatsächliche Zuwachs im Git-Pack pro
  Build — vor der Umsetzung an zwei echten Builds messen und bei Bedarf auf „nur `slim.json` ins
  Git, `bundle.json` ins Release" umschwenken.

  ### Pipeline 1 — Erinnerung (`balance_data_reminder.yml`)
  ```yaml
  on:
    schedule:
      - cron: '0 7 * * *'
    workflow_dispatch:
  ```

  Ablauf: neuesten `base_build` aus `Blizzard/s2client-proto` lesen → prüfen, ob
  `packages/balance-data/builds/<build>/` existiert → wenn nicht, POST auf die Discord-Webhook-URL.

  **Designentscheidung: das Repo ist der Zustand.** Es gibt keine Datei „letzter gesehener Build",
  keine Quittierung, kein Ack-Flag. Die Bedingung ist eine reine Funktion des Repo-Inhalts, und
  daraus folgt die wichtigste Eigenschaft: **Die Erinnerung löscht sich selbst.** In dem Moment, in
  dem der Upload durch ist, existiert das Verzeichnis, die Bedingung ist falsch, das Nörgeln hört
  auf. Kein Zustand, der auseinanderlaufen kann.

  **Versand über eine Channel-Webhook-URL, nicht über den Bot** — ein POST, kein Bot-Token, kein
  Gateway, Secret liegt in GitHub Actions. Der Bot ist für den *Rückweg* zuständig (Command), nicht
  für den Hinweg.

  **Nachrichtenkadenz:** Täglich in denselben Channel zu posten wäre nach zwei Wochen Rauschen, und
  ignoriertes Rauschen ist genau der Zustand, in dem SC2Mapster gestorben ist. Stattdessen: beim
  ersten Erkennen einmal posten, danach die bestehende Nachricht editieren (Discord-Webhooks können
  das per `PATCH /webhooks/{id}/{token}/messages/{message_id}`) und höchstens wöchentlich neu
  anstupsen. Die Message-ID wäre dann die einzige Zustandsinformation, die doch im Repo landen muss
  — alternativ verzichtet man darauf und postet schlicht wöchentlich statt täglich. **Offen, welche
  der beiden Varianten es wird.**

  **Die Nachricht nennt die Build-Nummer und den fertigen Command**, damit der Uploader sie nur
  kopieren muss. Das ist kein Kosmetikpunkt: Weil die Build-Nummer nicht aus dem ZIP ableitbar ist
  (siehe Konverter-Layout oben), landet eine falsch abgetippte Nummer als falsch einsortierter
  Datensatz im Repo.

  > **Caveat:** GitHub deaktiviert `schedule`-Workflows nach 60 Tagen Repo-Inaktivität und führt sie
  > unter Last verzögert aus. Bei diesem Repo ist Inaktivität kein Thema; die Verzögerung ist bei
  > einem 6-Wochen-Takt irrelevant.

  ### Pipeline 2 — Aufnahme (`balance_data_ingest.yml`)
  ```yaml
  on:
    repository_dispatch:
      types: [balance-data-upload]
    workflow_dispatch: # manueller Notausgang mit URL + Build
  ```

  Schritte:
  1. **ZIP laden** von der mitgelieferten Discord-CDN-URL — sofort, solange die Signatur gilt
  2. **Validieren** (siehe [Sicherheit](#sicherheit))
  3. **Entpacken** nach `<tmp>/<build>/BalanceData/`
  4. **Konvertieren:**
     `cargo run --example full -r -- --source <tmp> --json-balance-data-dir <leer> --output <out> balance-data-to-json`
     — Rust via `rustup`, nicht über ein Distro-Paket (die Lehre aus `replay_parser.yml`)
  5. **Bündeln:** `scripts/bundle.mts` fasst die 1.063 Dateien zu `bundle.json` + `slim.json` zusammen
  6. **Committen** nach `packages/balance-data/builds/<build>/` mit Message
     `chore(balance): add build <build>`
  7. **Release** `balance-<build>` anlegen, XML-ZIP als Asset anhängen
  8. **Rückmeldung** in den Discord-Channel — Erfolg *und* Fehlschlag. Ein stiller Fehlschlag wäre
     der direkte Weg zurück ins SC2Mapster-Szenario.

  ### Discord-Command
  Ergänzung in `apps/bot/scripts/register-commands.mts`, dem bestehenden Muster folgend:

  ```ts
  {
          name: 'balance-data',
          description: 'SC2-Balance-Data für einen Patch beisteuern.',
          contexts: [0], // guild only
          options: [
                  {
                          name: 'upload',
                          description: 'Editor-Export für einen base_build hochladen',
                          type: 1, // SUB_COMMAND
                          options: [
                                  {
                                          name: 'build',
                                          description: 'base_build aus der Erinnerungsnachricht',
                                          type: 4, // INTEGER
                                          required: true,
                                  },
                                  {
                                          name: 'file',
                                          description: 'ZIP des Editor-Exports',
                                          type: 11, // ATTACHMENT
                                          required: true,
                                  },
                          ],
                  },
          ],
  }
  ```

  Im Handler (`apps/bot/src/`, analog zu `match/handlers.ts`):
  - **Deferred Response (Type 5) zuerst.** Die 3-Sekunden-Frist reicht nicht für einen
    GitHub-Dispatch; die eigentliche Antwort kommt als Follow-up.
  - **Attachment aus `data.resolved.attachments`** holen — die Option selbst liefert nur die ID.
  - **Keine Zwischenspeicherung der URL.** Direkt an `repository_dispatch` durchreichen.
  - **Allowlist prüfen**, bevor irgendetwas passiert (siehe Sicherheit).

  ### Auslieferung an die Website
  **Hybrid:** die schlanke Datei (16 KB gzip) wird zur Build-Zeit mitgebündelt, damit die App ohne
  Netzwerk funktioniert. Nur für Builds, die **neuer** sind als der mitgelieferte Stand, wird zur
  Laufzeit nachgeladen (aus dem Release). Dann bricht nichts bei Netzwerkausfall, und ein neuer Patch
  erzwingt kein Redeploy — was erst die Entscheidung aus Punkt 3 oben (`paths-ignore`)
  widerspruchsfrei macht.

  `raw.githubusercontent.com` scheidet für den Laufzeit-Pfad aus: `Content-Type: text/plain` mit
  `nosniff` und Rate-Limit. **Ungeprüft** bleibt, ob Release-Downloads die nötigen **CORS-Header**
  für einen Browser-Fetch schicken (der Download läuft über einen Redirect auf
  `objects.githubusercontent.com`). Falls nicht, gibt es im Monorepo einen Ausweg, den ein externes
  Repo nicht hätte: **die eigene API** (`apps/api`) kann als schlanker Proxy mit korrekten Headern
  dienen.

  ### Fallback-Regel
  Findet sich kein exakter Build, nimm den **nächstniedrigeren** vorhandenen und markiere das
  Ergebnis als `approximated: true`. Die UI muss das sichtbar machen.

  Diese Regel ist nicht optional: Der Crate liefert bei fehlendem Build **leere Strings statt eines
  Fehlers** (oben belegt). Ohne eigene Fallback-Logik zeigt die Analyse an jedem Patchtag
  stillschweigend leere Felder — der denkbar schlechteste Fehlermodus, weil er wie ein Datenfehler
  aussieht und nicht wie eine fehlende Lieferung.

  ### Weitere Designentscheidungen
  - **Tag und Verzeichnis tragen den `base_build`, nicht die Marketing-Version.** Ein Replay liefert
    `97563`, nicht „5.0.16" — nur `base_build` ist der Schlüssel, mit dem nachgeschlagen wird.
  - **Ein Bundle statt 1.063 Dateien.** Die Datei-pro-Einheit-Struktur ist eine Konvention des
    Crates (`to_writer_pretty` pro Unit), kein Formatzwang. Für Konsumenten sind das 1.063
    HTTP-Requests gegen einen.
  - **Zwei Stufen strikt entkoppeln.** Stufe 1 (Beschaffung) ist fragil und braucht einen Menschen;
    Stufe 2 (Konvertierung/Release) ist robust und darf **nie** an Stufe 1 hängen. Fehlt ein Export,
    liefert das Package weiterhin alle vorhandenen Builds aus, statt rot zu sein.
  - **Upload ist idempotent.** Existiert `builds/<build>/` bereits, bricht die Pipeline ab, statt zu
    überschreiben — mit klarer Discord-Rückmeldung. Erneutes Einspielen nur über
    `workflow_dispatch` mit explizitem Flag.

  ## Sicherheit

  Zwei Angriffsflächen, die es im Eigen-Repo-Entwurf nicht gab:

  ### Der Bot bekommt Schreibrechte aufs Repo
  `repository_dispatch` braucht einen GitHub-Token mit `contents: write`. Damit gilt: **Wer den
  Command auslösen darf, kann den Bot dazu bringen, in das Repo zu schreiben.**

  - **Fine-grained PAT**, ausschließlich auf dieses Repo, nur `contents: write` — kein klassischer
    PAT mit Vollzugriff. Besser noch eine GitHub App mit Installation-Token, falls der Aufwand passt.
  - **Env über `apps/bot/src/config.ts`** nach bestehendem Zod-Muster, Pflichtfeld mit `min()`.
  - **Allowlist auf Rolle oder User-IDs**, geprüft *vor* dem Dispatch. Das Muster für
    Permission-Checks existiert aus `#86`/`#87`.
  - **Der Workflow schreibt ausschließlich unter `packages/balance-data/builds/`** — nie woanders hin.

  ### Das ZIP ist fremde, unvalidierte Eingabe
  Es stammt aus Discord, nicht aus dem Repo. Vor dem Entpacken:
  - **Größenobergrenze** prüfen (`Content-Length` *und* tatsächlich gelesene Bytes)
  - **Zip-Slip verhindern:** keine Einträge mit `..` oder absoluten Pfaden
  - **Nur `*.xml` extrahieren**, alles andere verwerfen — der Export enthält auch Bilder, die wir im
    MVP nicht brauchen
  - **Entpackte Gesamtgröße deckeln** (Zip-Bomb)
  - **Plausibilität:** Dateianzahl in erwarteter Größenordnung (~1.000–1.600), sonst abbrechen

  ## Risiken
  - **Das Feature löst ein Problem, das wir noch nicht haben.** Siehe Update vom 24.10.: Tracker
    Events liefern aufgelöste Namen. Gebaut werden sollte das hier erst, wenn eine konkrete Analyse
    Game Events oder Stats verlangt — sonst ist es Infrastruktur ohne Konsumenten, und genau solche
    Infrastruktur verfällt.
  - **Der manuelle Schritt bleibt der Sollbruchpunkt.** Die Pipelines automatisieren *Erinnerung*
    und *Konvertierung*, nicht die *Beschaffung*. Jemand muss pro Patch (~alle 6 Wochen) den Editor
    öffnen. Die Erinnerungsschleife adressiert den wahrscheinlichsten Fehlermodus (Vergessen), nicht
    alle (Urlaub, kein Windows-Rechner, Desinteresse). Der Discord-Upload mildert das, weil er den
    Kreis der Beitragenden über eine Person hinaus öffnet.
  - **Aufwand/Nutzen-Verhältnis ist unkonventionell.** Das System bedient ~8 Uploads pro Jahr. Ein
    Kalendereintrag leistete 80 % davon. Die restlichen 20 % — *jeder im Server kann beitragen* —
    sind das eigentliche Argument; ohne diesen Teil wäre das Feature überbaut.
  - **Keine belegte Headless-Automatisierung.** Die CLI-Option `-exportreplay/-exportreplaydir`
    stammt aus Patch 2.0.10 (2013); ob sie in aktuellen Versionen noch funktioniert, ist
    **ungeprüft**. UI-Automation (AutoHotkey o.ä.) wäre die fragile Alternative.
  - **Rechtliches:** Das sind aus dem Spiel exportierte Blizzard-Daten. Kein Rechtsrat, aber ein
    Fakt, der dafür spricht: Blizzards eigene Patchnotes beschreiben den Export ausdrücklich als
    „web-friendly", also zum Veröffentlichen gebaut, und Fan-Seiten nutzen das seit über zehn
    Jahren. Ein README mit Quellenangabe, nicht-kommerziellem Charakter und Take-down-Bereitschaft
    ist trotzdem angebracht. `HADB/sc2-balance-data` hat bewusst keine Lizenzdatei — wer dessen
    Daten übernimmt, sollte vorher beim Autor nachfragen.
  - **Fremde Daten im Repo, das auch die App ist.** Im eigenen Repo wäre ein Take-down ein
    isolierter Vorgang gewesen; hier beträfe er das Repo mit dem Anwendungscode. Die XML liegen
    deshalb in **Releases**, nicht im Code-Pfad — entfernbar, ohne die Historie der App anzufassen.
  - **ID-Kompatibilität ungeprüft:** ob die IDs aus `stableid.json` (Bot-API) mit den
    `abil_link`-Werten in Replays übereinstimmen, ist nicht verifiziert. Stimmen sie, erübrigt sich
    dieses Konzept für alles außer Stats und Icons.
  - **Repo-Wachstum** durch JSON pro Build ist klein, aber nicht null. Nach zwei Jahren neu
    bewerten; notfalls auf „nur `slim.json` im Git" reduzieren.

  ## Offene Fragen

## Offene Fragen
- **Brauchen wir Game Events überhaupt?** Erst eine konkrete Analyse-Idee, die Tracker Events
  nicht hergeben, rechtfertigt dieses Feature. **Vor allem anderen zu klären.**
- **Stimmen `stableid.json`-IDs mit den `abil_link`-Werten in Replays überein?** Wenn ja, löst die
  offizielle MIT-Datei den Game-Events-Fall ohne jede eigene Lieferkette, und es bleibt nur noch
  die Kür.
- Schicken GitHub-Release-Downloads CORS-Header für Browser-Fetch? (entscheidet Release-Fetch vs.
  API-Proxy)
- Baut das `full`-Example mit `--no-default-features`? (nur Build-Zeit, kein Blocker)
- Wie groß wird ein pretty-printed `bundle.json` im Git-Pack pro Build wirklich?
- Erinnerung mit editierter Nachricht (braucht eine Message-ID im Repo) oder schlicht wöchentlich
  neu posten (zustandslos)?
- Funktioniert die CLI-Option `-exportreplay` in aktueller SC2-Version? (entscheidet über eine
  spätere Vollautomatisierung)

## Umsetzungsreihenfolge

Bewusst so sortiert, dass die billigsten Fragen mit der größten Hebelwirkung zuerst kommen und
jede Stufe für sich nutzbar ist. **Die Schritte 0 und 1 können beide ergeben, dass die Schritte
2–7 nie gebaut werden müssen.**

0. **Konkreten Bedarf benennen.** Welche Analyse braucht Game Events oder Stats? Ohne Antwort
   bleibt das Dokument ein Bauplan auf Vorrat.
1. **`stableid.json` gegen ein echtes Replay prüfen.** Etwa eine Stunde Arbeit. Passen die IDs,
   ist der Game-Events-Fall ohne Lieferkette gelöst und nur noch Stats/Icons offen.
2. **Konvertierung einmal lokal durchspielen** — ein Export, ein Build, `bundle.mts` schreiben.
   Liefert die echten Größenzahlen für die offene Frage zum Git-Pack.
3. **Package `@onog/balance-data`** mit Fallback-Auflösung und einem eingecheckten Build.
   Ab hier ist das Feature für die App nutzbar, auch ohne jede Automatisierung.
4. **`balance_data_ingest.yml`** plus `workflow_dispatch`-Notausgang. Noch ohne Discord — mit
   manuell übergebener URL testbar.
5. **`tag_release.yml` absichern** (`paths-ignore`). Muss **vor** dem ersten Daten-Commit auf
   `main` stehen, sonst deployt der erste Upload die App.
6. **`balance_data_reminder.yml`** — der Teil, der das Projekt am Leben hält.
7. **Discord-Command** als letztes. Er ist Komfort auf einer Kette, die vorher schon funktioniert.

---

Zusammenfassung der Session:

- Geschrieben wurde nichts auf die Platte. Dein Arbeitsverzeichnis ist sauber, du stehst auf main bei 0bb2e72.
- Aufräumen: git branch -D docs-balance-data-monorepo — der leere Branch ist von meinem Worktree-Versuch übrig.
- Vier Dinge am Code verifiziert statt angenommen: der tag_release.yml-Trigger, das Konverter-Interface im Fork (example, nicht bin; Build-Nummer kommt aus dem Pfad), die Discord-Limits (Option-Type 11, 20 MiB, signierte URLs), und dein Update vom 24.10. gegen replay-analysis-research.md:40-41.
- Die inhaltlich wichtigste Änderung gegenüber meinem ersten Entwurf: Dein Befund vom 24.10. stimmt und ist stärker, als ich zunächst angesetzt hatte. Tracker Events liefern bereits aufgelöste Namen — das Register brauchst du nur für Game Events (abil_link) oder Stats/Icons. Deshalb steht jetzt ein Schritt 0 vor der Umsetzungsreihenfolge: erst den konkreten Bedarf benennen, sonst baust du Infrastruktur ohne Konsumenten.