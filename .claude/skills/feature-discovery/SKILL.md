---
name: feature-discovery
description: Erarbeitet gemeinsam mit dem User ein neues Feature von der Idee bis zum umsetzbaren Konzept (feature-concept.md) als Vorlage für create-issue. Trigger bei "Lass uns ein Feature erarbeiten", "Neues Feature planen".
---

# Skill: Feature Discovery & Technische Analyse

## Zweck

Gemeinsam mit dem User ein neues Feature strukturiert erarbeiten – von der ersten Idee bis zu einem vollständigen, umsetzbaren Konzept. Das Ergebnis ist ein Artefakt, das als Input für die Issue-Erstellung dient.

---

## Aktivierung

Dieser Skill wird aktiviert wenn der User z.B. sagt:
- "Lass uns ein Feature erarbeiten"
- "Ich habe eine Idee für ein neues Feature"
- "Neues Feature planen"

---

## Phase 1: Feature Discovery

Ziel: Das Feature vollständig verstehen und abgrenzen.

### Ablauf

1. **Feature-Idee aufnehmen** – Der User beschreibt das gewünschte Feature in eigenen Worten.
2. **Rückfragen stellen** – Kläre aktiv:
   - Wer ist die Zielgruppe / welche Rolle profitiert? (z.B. Spieler, Admin, Zuschauer)
   - Welches Problem wird gelöst oder welcher Mehrwert entsteht?
   - Gibt es bereits ähnliche Funktionalität im Projekt?
   - Gibt es externe Abhängigkeiten (APIs, Services, Pakete)?
   - Gibt es Design-Vorstellungen oder UX-Anforderungen?
3. **Scope festlegen** – Gemeinsam definieren, was zum MVP gehört und was als Erweiterung gilt.

---

## Phase 2: Technische Analyse

Ziel: Den technischen Rahmen für die Umsetzung verstehen.

### Ablauf

1. **Codebase analysieren** – Untersuche die relevanten Teile des Projekts:
   - Projektstruktur: TanStack Start + Nitro Backend, React 19, TailwindCSS 4
   - Bestehende Routen, Komponenten, Server-API-Endpunkte
   - Bestehende Patterns und Konventionen
2. **Architektur-Entscheidungen treffen** – Gemeinsam klären:
   - Welche neuen Routen / Seiten werden benötigt?
   - Welche API-Endpunkte (Server-Funktionen, Nitro-Routes) sind nötig?
   - Welche Komponenten müssen erstellt oder angepasst werden?
   - Brauchen wir neue Dependencies?
   - Gibt es Datenbankänderungen oder externe Integrationen?
3. **Abhängigkeiten identifizieren** – Welche Teile bauen aufeinander auf?

---

## Output: Feature-Konzept Artefakt

Am Ende dieses Skills wird ein **Feature-Konzept** als Artefakt erstellt (`feature-concept.md`) mit folgender Struktur:

```markdown
# Feature: [Name]

## Zusammenfassung
Kurze Beschreibung des Features in 2-3 Sätzen.

## Motivation / Problem
Warum wird dieses Feature benötigt? Welches Problem löst es?

## Zielgruppe
Wer profitiert von diesem Feature?

## Scope

### MVP (Must-Have)
- Funktion 1
- Funktion 2

### Erweiterungen (Nice-to-Have)
- Erweiterung 1
- Erweiterung 2

### Out-of-Scope
- Was explizit NICHT Teil dieses Features ist

## Technisches Konzept

### Betroffene Bereiche
- Bestehende Dateien die angepasst werden
- Neue Dateien die erstellt werden

### Architektur
Beschreibung der technischen Umsetzung, ggf. mit Mermaid-Diagramm.

### Abhängigkeiten
- Externe Pakete / APIs
- Interne Abhängigkeiten zwischen Teilen

### Risiken
- Identifizierte technische Risiken

## Offene Fragen
- Falls noch ungeklärte Punkte bestehen
```

### Wichtige Regeln

- **Sprache**: Deutsch (wie das gesamte Projekt-Tooling).
- **Iterativ arbeiten**: Nicht alles auf einmal klären – lieber mehrere kurze Feedback-Runden mit dem User.
- **Keine Implementierung**: In diesem Skill wird KEIN Code geschrieben. Nur Analyse und Konzeption.
- **Artefakt ist der Vertrag**: Das Feature-Konzept dient als Übergabe an den `create-issues` Skill.
