# Konzept: SC2-Datenregister (eigenes Projekt)

> **Kein Teil von [`replay-library-local.md`](./replay-library-local.md).** Dieses Dokument hält
> Rechercheergebnisse und Ideen für ein **eigenes, separates Repository** fest. Es blockiert
> nichts am laufenden Replay-Feature und wird erst relevant, wenn wir Replay-Daten über die
> Basis-Metadaten hinaus auflösen wollen (Build-Orders, Einheiten-Namen, Icons).

## Zusammenfassung
Ein eigenes GitHub-Repository, das SC2-Stammdaten **pro Spiel-Patch** vorhält und maschinell
abrufbar macht. Die XML-Exporte aus dem SC2-Editor liegen versioniert im Repo, eine GitHub-CI
konvertiert sie zu JSON und veröffentlicht sie als **Release pro `base_build`**. Wer einen
neuen Patch beisteuern will, lädt nur die XML-Dateien hoch — den Rest erledigt die Pipeline.

## Motivation / Problem
Ein SC2-Replay speichert Aktionen **nur als numerische IDs** — sinngemäß „Spieler 1 nutzte
Ability-Index 41 an Einheit-Typ 71". Um daraus lesbares „Spieler 1 baute ein Supply Depot" zu
machen, braucht man das Wörterbuch **für genau diese Patch-Version**. Blizzard ändert mit jedem
Patch die Balance-Werte und teilweise die IDs, es gibt also nicht *ein* Wörterbuch, sondern
eines pro Build.

Die Recherche (siehe unten) zeigt: **Es existiert keine verlässliche, gepflegte Quelle dafür.**
Alle gefundenen Projekte sind manuell gepflegt und veraltet oder eingeschlafen. Wer Build-Order-
Analysen bauen will, braucht diese Datenlieferkette — und muss sie selbst betreiben.

## Zielgruppe
- **Wir selbst** als Konsument einer späteren Replay-Analyse (ONOG)
- **Andere SC2-Tool-Entwickler**, falls wir das Repo öffentlich pflegen — die Lücke ist real und
  unbesetzt

## Rechercheergebnisse (Stand 2026-09-12)

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

### Vorhandene Quellen und ihr Zustand

| Quelle | Inhalt | Stand | Pflege | Lizenz |
|---|---|---|---|---|
| [`Blizzard/s2client-proto`](https://github.com/Blizzard/s2client-proto) | `stableid.json` (796 KB): IDs → Namen | 07/2026, bis Build **97563** | **offiziell, aktiv** | MIT |
| [`HADB/sc2-balance-data`](https://github.com/HADB/sc2-balance-data) | Editor-XML, exakt unser Format | 07/2026, Builds 96883–97425 | manuell (`Bean`), alle Commits an einem Tag nachgetragen | **keine** ⚠️ |
| [`SC2Mapster/SC2GameData`](https://github.com/SC2Mapster/SC2GameData) | rohe GameData-XML | 06/2026, bis 97364 | **war automatisiert** (Bot `Talvbot`), README: *„no longer receiving active updates, tooling and automation is broken"* | keine |
| [`Ahli/sc2xml`](https://github.com/Ahli/sc2xml) | rohe GameData-XML | 10/2025, bis 95162 | manuell, schubweise | keine |

Der Autor von `s2protocol-rs` exportiert **von Hand**; sein README führt einen Remote-Feed als
offenes TODO. Kein einziges Projekt hat GitHub Actions.

### Die wichtigste Erkenntnis: SC2Mapster ist der Präzedenzfall
`SC2Mapster/SC2GameData` hatte **genau die Automatisierung, die wir bauen wollen** — jahrelange
Bot-Commits im Muster `SC2 5.0.16.97364`. Am 29.06.2026 hat der Maintainer von Hand den Hinweis
nachgeschoben, dass Tooling und Automation kaputt sind.

Der Engpass ist also **nicht die Konvertierung** (die läuft in CI problemlos), sondern der
Schritt davor: das Ziehen der Daten aus einer Spielinstallation. Der Bot ist nicht am JSON
gescheitert, sondern daran, dass Blizzard etwas am Client, an CASC oder am Editor geändert hat.

### `stableid.json` deckt mehr ab als erwartet
Die offizielle, MIT-lizenzierte Datei ist **kein reiner Versionshinweis**:

| Kategorie | Einträge | Beispiel |
|---|---|---|
| `Abilities` | 3.797 | `{"id": 0, "index": 255, "name": "Null", "buttonname": "Null"}` |
| `Units` | 1.943 | `{"id": 0, "name": "NotAUnit"}` |
| `Upgrades` | 296 | |
| `Buffs` / `Effects` | 289 / 13 | |

**Konsequenz:** Eine Build-Order-Liste („12 Supply Depot, 13 Barracks, …") braucht im Kern nur
die Auflösung ID → **Name** — und die liefert `stableid.json` aus offizieller, aktiv gepflegter
Quelle. Balance Data braucht man erst für die Kür: **Stats** (Kosten, Leben, Rüstung, Schaden),
Icons, Stärken/Schwächen, Ressourcen-Kurven.

Zwei ungeprüfte Haken: `stableid.json` liegt nur in der **jeweils aktuellen** Fassung im
Master-Branch — ältere Builds müssten über die Git-Historie geholt werden (automatisierbar). Und
`s2client-proto` zielt auf die **Bot-API**, deren IDs nicht zwangsläufig identisch mit den
replay-internen IDs sind. Das wäre an einem echten Replay zu verifizieren, bevor man darauf baut.

### Größenmessungen (Build 97563, 1.063 Einheiten)

| Variante | Größe | gzip |
|---|---|---|
| Wie im Crate: 1.063 Einzeldateien auf der Platte | 5,3 MB | — |
| Ein Build, alle Einheiten **gebündelt** (minified) | 1,53 MB | **110 KB** |
| Nur `id → name/race/icon/index` („schlank") | 86 KB | **16 KB** |

Die 5,3 MB sind überwiegend Dateisystem-Overhead und Formatierung. **Hosting ist damit kein
Kostenfaktor** — ein kompletter Build liegt gzip bei 110 KB.

## Scope

### MVP
- **Eigenes Repository** mit den Editor-XML-Exporten, abgelegt pro `base_build`
- **GitHub-Actions-Pipeline**: XML → JSON über `s2protocol-rs`
  (`balance-data-to-json`, nutzt unseren Fork `j-toscani/s2protocol-rs`)
- **Ein Release pro `base_build`**, Tag = die Build-Nummer
- **Gebündelte Artefakte** statt 1.063 Einzeldateien: ein vollständiges JSON und eine schlanke
  Variante pro Build
- **Beitragen = XML hochladen.** Die Pipeline erledigt Konvertierung, Bündelung und Release

### Erweiterungen
- **Trigger-Job**: Cron pollt `Blizzard/s2client-proto` auf neue `base_build`s und legt
  automatisch ein Issue „Build X fehlt" an
- **`stableid.json` mitausliefern** — pro Build aus der Git-Historie von `s2client-proto` gezogen
- npm-Package als zusätzlicher Auslieferungsweg (siehe Auslieferung)
- Diff-Ansicht: Balance-Änderungen zwischen zwei Builds

### Out-of-Scope
- Automatischer Datenexport ohne Menschen (siehe Risiken — nicht realistisch)
- Icons/Bilder aus dem Editor-Export (erst wenn eine UI sie braucht)
- Eigener Auflösungs-Layer für rohe CASC-GameData (Mod-Vererbung core → liberty → swarm → void)

## Technisches Konzept

### Architektur
```
Mensch: SC2-Editor -> File > Export Balance Data
              |
              v
   Repo: xml/<base_build>/*.xml        <- einziger manueller Schritt
              |
              v
   GitHub Actions: s2protocol-rs balance-data-to-json
              |
              +--> bundle.json        (alle Einheiten, ~110 KB gzip)
              +--> slim.json          (id -> name/race/icon, ~16 KB gzip)
              |
              v
   Release, Tag = <base_build>
```

### Designentscheidungen
- **Tag ist der `base_build`, nicht die Marketing-Version.** Ein Replay liefert `97563`, nicht
  „5.0.16" — nur `base_build` ist der Schlüssel, mit dem ein Konsument nachschlagen kann.
- **Fallback-Regel Pflicht:** Findet sich kein exakter Build (frischer Patch, noch niemand hat
  exportiert), nimm den **nächstniedrigeren** und markiere das Ergebnis als „approximiert". Ohne
  diese Regel ist jede Analyse an dem Tag kaputt, an dem Blizzard patcht.
- **Ein Bundle statt 1.063 Dateien.** Die Datei-pro-Einheit-Struktur ist eine Konvention des
  Crates, kein Formatzwang. Für Konsumenten sind das 1.063 HTTP-Requests gegen einen.
- **Zwei Stufen strikt entkoppeln.** Stufe 1 (Beschaffung) ist fragil und braucht im Notfall
  einen Menschen; Stufe 2 (Konvertierung/Release) ist robust und darf **nie** an Stufe 1 hängen.
  Fehlt ein Export, liefert das Repo weiterhin alle vorhandenen Builds aus, statt rot zu sein.
  Das ist die direkte Lehre aus dem SC2Mapster-Präzedenzfall.
- **XML als Quelle im Repo** (nicht nur JSON): diffbar, reproduzierbar — und Balance-Änderungen
  zwischen Patches werden als Git-Diff sichtbar.

### Auslieferung
GitHub Releases sind der von GitHub **vorgesehene** Kanal für Artefakte (2 GB pro Datei).
`raw.githubusercontent.com` scheidet aus: Es liefert `Content-Type: text/plain` mit `nosniff`
und ist rate-limitiert — für Browser-Konsum unbrauchbar.

**Ungeprüft:** ob Release-Downloads die nötigen **CORS-Header** für einen Browser-Fetch schicken
(der Download läuft über einen Redirect auf `objects.githubusercontent.com`). Falls nicht, ist
ein **npm-Package** die Alternative: versioniert, über jsDelivr/unpkg mit korrektem CORS und
CDN-Caching, direkt vom Bundler konsumierbar.

**Robusteste Variante ist hybrid:** die schlanke Datei (16 KB gzip) zur Build-Zeit mitbündeln,
damit die App ohne Netzwerk funktioniert — und nur für Builds, die neuer sind als der
mitgelieferte Stand, zur Laufzeit nachladen. Dann bricht nichts bei Netzwerkausfall, und ein
neuer Patch erzwingt kein Redeploy.

### Abhängigkeiten
- `j-toscani/s2protocol-rs` (unser Fork) für die XML→JSON-Konvertierung
- `Blizzard/s2client-proto` als Build-Trigger und Namensquelle
- Eine Windows-Installation von SC2 samt Editor für den manuellen Export

## Risiken
- **Der manuelle Schritt ist der Sollbruchpunkt.** Die CI automatisiert die *Konvertierung*,
  nicht die *Beschaffung*. Jemand muss pro Patch (~alle 6 Wochen) den Editor öffnen. Genau dieser
  Teil schläft in allen untersuchten Projekten ein.
- **Keine belegte Headless-Automatisierung.** Die CLI-Option `-exportreplay/-exportreplaydir`
  stammt aus Patch 2.0.10 (2013); ob sie in aktuellen Versionen noch funktioniert, ist
  **ungeprüft** — das ist die einzige echte Automatisierungschance und wäre als Erstes zu testen.
  UI-Automation (AutoHotkey o.ä.) wäre die fragile Alternative.
- **Rechtliches:** Das sind aus dem Spiel exportierte Blizzard-Daten. Kein Rechtsrat, aber ein
  Fakt, der dafür spricht: Blizzards eigene Patchnotes beschreiben den Export ausdrücklich als
  „web-friendly", also zum Veröffentlichen gebaut, und Fan-Seiten nutzen das seit über zehn
  Jahren. Ein README mit Quellenangabe, nicht-kommerziellem Charakter und Take-down-Bereitschaft
  ist trotzdem angebracht. `HADB/sc2-balance-data` hat bewusst keine Lizenzdatei — wer dessen
  Daten übernimmt, sollte vorher beim Autor nachfragen.
- **ID-Kompatibilität ungeprüft:** ob die IDs aus `stableid.json` (Bot-API) mit den
  replay-internen IDs übereinstimmen, ist nicht verifiziert.

## Offene Fragen
- Funktioniert die CLI-Option `-exportreplay` in aktueller SC2-Version? (entscheidet über
  Automatisierbarkeit)
- Schicken GitHub-Release-Downloads CORS-Header für Browser-Fetch? (entscheidet Releases vs. npm)
- Stimmen `stableid.json`-IDs mit den Replay-IDs überein? (entscheidet, ob Balance Data für
  Build-Orders überhaupt nötig ist)
- Reicht uns langfristig `stableid.json` allein — und wird die Balance Data damit zum reinen
  Nice-to-have für Icons und Stats?
