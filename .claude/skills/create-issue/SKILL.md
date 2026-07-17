---
name: create-issue
description: Teilt ein Feature-Konzept (z.B. aus feature-discovery) in Epic/Story/Tech-Issues auf und legt sie via gh im Repo j-toscani/oldnerds-playing-older-games an. Trigger bei "Erstelle die Issues aus unserem Konzept", "Leg die Issues an".
---

# Skill: GitHub Issues erstellen

## Zweck

Ein erarbeitetes Feature-Konzept in sinnvolle, umsetzbare GitHub Issues aufteilen und im Repository `j-toscani/oldnerds-playing-older-games` anlegen. Dieser Skill konsumiert das Artefakt aus dem `feature-discovery` Skill oder ein anderes strukturiertes Konzept.

---

## Aktivierung

Dieser Skill wird aktiviert wenn der User z.B. sagt:
- "Erstelle die Issues aus unserem Konzept"
- "Leg die Issues an"
- "Mach Issues daraus"

---

## Voraussetzungen

- Ein **Feature-Konzept** liegt als Artefakt vor (aus dem `feature-discovery` Skill oder vom User bereitgestellt).
- Die GitHub CLI (`gh`) ist verfügbar und authentifiziert.

---

## Phase 1: Issue-Planung

Ziel: Das Konzept in sinnvolle Issues aufteilen.

### Ablauf

1. **Epic formulieren** – Das übergeordnete Feature wird als Epic zusammengefasst.
2. **Stories ableiten** – Jede eigenständige Nutzer-Funktion wird eine Story:
   - Formulierung: "Als [Rolle] möchte ich [Funktion], damit [Nutzen]."
   - Klare Akzeptanzkriterien mit Checkboxen
   - Abhängigkeiten zwischen Stories kennzeichnen
3. **Technical Issues identifizieren** – Infrastruktur-Aufgaben ohne direkten User-Mehrwert:
   - Setup, Refactoring, CI/CD, Konfiguration
   - Priorität festlegen (Hoch/Mittel/Niedrig)
4. **Reihenfolge festlegen** – Logische Bearbeitungsreihenfolge unter Berücksichtigung der Abhängigkeiten.

### Ergebnis

Eine **Issue-Liste** als Artefakt zur Review, z.B.:

```markdown
## Epic
- [EPIC] Feature-Name – Beschreibung

## Stories (in Bearbeitungsreihenfolge)
1. [STORY] Story-Titel – User Story + Akzeptanzkriterien
2. [STORY] Story-Titel – User Story + Akzeptanzkriterien

## Technical Issues
1. [TECH] Tech-Titel – Beschreibung + Priorität
```

---

## Phase 2: Issues erstellen

Ziel: Die freigegebenen Issues im GitHub Repository anlegen.

### ⚠️ WICHTIG: Erst nach expliziter User-Freigabe!

**NIEMALS Issues ohne Bestätigung des Users erstellen.**

### Kommandos

```bash
# Epic erstellen
gh issue create \
  --repo j-toscani/oldnerds-playing-older-games \
  --title "[EPIC] Feature-Name" \
  --body "## Beschreibung
Feature-Beschreibung...

## Anmerkungen
Zusätzliche Details..."

# Story erstellen
gh issue create \
  --repo j-toscani/oldnerds-playing-older-games \
  --title "[STORY] Story-Titel" \
  --body "## User Story
Als [Rolle] möchte ich [Funktion], damit [Nutzen].

## Akzeptanzkriterien
- [ ] Kriterium 1
- [ ] Kriterium 2

## Anmerkungen
Weitere Details...

---
Epic: #<epic-issue-number>"

# Technical Issue erstellen
gh issue create \
  --repo j-toscani/oldnerds-playing-older-games \
  --title "[TECH] Technischer Titel" \
  --body "## Beschreibung
Was ist das technische Problem oder die Verbesserung?

## Motivation
Warum ist diese Änderung nötig?

## Lösungsvorschlag
Mögliche Lösung...

## Betroffene Bereiche
- Bereich 1
- Bereich 2

## Priorität
Hoch / Mittel / Niedrig

---
Epic: #<epic-issue-number>"
```

### Ablauf

1. **Epic zuerst erstellen** – Die Issue-Nummer wird für Verlinkungen benötigt.
2. **Stories und Tech-Issues erstellen** – Mit Referenz auf das Epic.
3. **Ergebnis dokumentieren** – Liste aller erstellten Issues mit Nummern und Links.

---

## Regeln

- **Sprache**: Alle Issues auf **Deutsch** (passend zu den bestehenden Templates).
- **Keine Labels**: Das Repo verwendet keine Labels. Issue-Typ wird über den Titel-Prefix kenntlich gemacht (`[EPIC]`, `[STORY]`, `[TECH]`, `[BUG]`).
- **Keine eigenmächtigen Aktionen**: Issues werden NUR nach expliziter Freigabe erstellt.
- **Template-Konformität**: Issue-Bodies folgen der Struktur der vorhandenen YAML-Templates in `.github/ISSUE_TEMPLATE/`.
- **Verlinkung**: Stories und Tech-Issues referenzieren ihr zugehöriges Epic.
- **Granularität**: Jede Story sollte in ~1–3 Stunden umsetzbar sein.
- **Reihenfolge**: Epic → Stories → Technical Issues (wegen Verlinkung).

