---
name: commit-message
description: Generiert eine Conventional-Commits-Message aus git diff und dem Conversation-Transcript (inkl. dem "Warum" hinter den Änderungen). Trigger bei "Commit Message generieren", "Was sollte ich committen?".
---

# Skill: Commit Message generieren

## Zweck

Aus dem aktuellen `git diff` und dem Gesprächsverlauf eine aussagekräftige Commit Message im **Conventional Commits**-Format generieren — inklusive Body mit dem "Warum" hinter den Änderungen.

Der Unterschied zu einem einfachen `git log`-Ansatz: Dieser Skill liest zusätzlich den **Conversation Transcript**, um zu verstehen, welche Probleme adressiert wurden, welche Abwägungen getroffen wurden und welche Entscheidungen dahinterstecken.

---

## Aktivierung

Dieser Skill wird aktiviert wenn der User z.B. sagt:
- "Generiere eine Commit Message"
- "Schreib mir eine Commit Message"
- "Was sollte ich committen?"
- "Erstelle einen Commit-Vorschlag"

---

## Phase 1: Änderungen analysieren

### 1.1 Staged vs. Unstaged klären

Prüfe zunächst den Status:

```bash
git status
git diff --cached   # nur staged Änderungen (für den nächsten Commit)
git diff            # unstaged Änderungen
```

Falls keine Dateien gestaged sind, weise den User darauf hin und zeige trotzdem
einen Vorschlag für alle geänderten Dateien (`git diff HEAD`).

### 1.2 Diff lesen

```bash
git diff --cached --stat         # Übersicht welche Dateien betroffen sind
git diff --cached                # Vollständiger Diff für den Inhalt
```

Aus dem Diff extrahieren:
- Welche **Dateien** wurden geändert?
- Welche **Packages / Module** sind betroffen?
- Was wurde **hinzugefügt**, **entfernt**, **umbenannt**?

---

## Phase 2: Conversation Context lesen

> [!IMPORTANT]
> Dies ist der entscheidende Unterschied zu einem rein diff-basierten Ansatz.
> Der Transcript enthält das "Warum" — Entscheidungen, Abwägungen, verworfene
> Alternativen — die aus dem Diff allein nicht ersichtlich sind.

### 2.1 Conversation ID ermitteln

Die aktuelle Conversation ID ist im System-Kontext bekannt. Sie kann auch aus
dem App-Data-Verzeichnis abgeleitet werden:

```
~/.gemini/antigravity/brain/<conversation-id>/
```

### 2.2 Transcript lesen

Lies die kompakte Transcript-Datei:

```
~/.gemini/antigravity/brain/<conversation-id>/.system_generated/logs/transcript.jsonl
```

Suche darin nach:
- **USER_INPUT**-Einträgen (was hat der User gefragt / gefordert?)
- **PLANNER_RESPONSE**-Einträgen (welche Entscheidungen wurden getroffen?)
- Erwähnungen der betroffenen Dateien aus Phase 1

Hilfreiche Shell-Befehle zum gezielten Lesen:

```bash
# Nur User-Nachrichten extrahieren
grep '"type":"USER_INPUT"' transcript.jsonl | tail -n 20

# Nach bestimmten Dateinamen suchen
grep 'Dockerfile\|docker\|bun install' transcript.jsonl | tail -n 10
```

### 2.3 Kontext extrahieren

Aus dem Transcript herausarbeiten:
- **Welches Problem** wurde gelöst? (Fehlermeldung, CI-Fehler, Ineffizienz...)
- **Welche Alternativen** wurden diskutiert und warum verworfen?
- **Welche Absprachen** wurden explizit getroffen? (z.B. "Ja, mach das")
- **Welche Constraints** gelten? (z.B. "Image muss minimal bleiben")

---

## Phase 3: Commit Message generieren

### Format: Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type — wähle den passenden:

| Type       | Bedeutung                                    |
|------------|----------------------------------------------|
| `feat`     | Neues Feature                                |
| `fix`      | Bugfix                                       |
| `chore`    | Wartung, Konfiguration, Tooling              |
| `refactor` | Refactoring ohne Feature/Fix                 |
| `perf`     | Performance-Verbesserung                     |
| `ci`       | CI/CD-Änderungen                             |
| `docs`     | Nur Dokumentation                            |
| `style`    | Formatting, kein Logik-Change                |
| `test`     | Tests hinzufügen oder anpassen               |

#### Scope — betroffenes Paket / Bereich:

Ableiten aus den geänderten Dateien:
- `apps/api` → `api`
- `apps/website` → `website`
- `.github/workflows` → `ci`
- `packages/shared` → `shared`
- Mehrere Bereiche → weglassen oder komma-separiert: `(ci,docker)`

#### Subject — imperative, max. 72 Zeichen:

- Englisch (wie in den bisherigen Commits des Repos)
- Imperativ: "add", "fix", "update", "remove" — nicht "added", "fixes"
- Kein Punkt am Ende

#### Body — das "Warum":

- Aus dem Conversation-Kontext ableiten (Phase 2)
- Erklärt Motivation und Entscheidungen, nicht was der Code tut
- Absätze mit Leerzeile trennen
- Aufzählungen mit `-` für mehrere Punkte
- Maximal 3–5 prägnante Punkte

#### Footer — nur wenn relevant:

```
Closes #<issue-number>
Co-authored-by: ...
BREAKING CHANGE: ...
```

---

## Phase 4: Vorschlag und Diskussion

Gib die Commit Message als **Codeblock** aus:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Erkläre kurz im Fließtext (1–2 Sätze):
- Warum du diesen Type gewählt hast
- Falls es mehrere sinnvolle Varianten gibt, zeige max. 2 Alternativen

Danach **warten**: Frage den User explizit ob er den Vorschlag so übernehmen
möchte, etwas ändern will, oder ob du direkt committen sollst:

> "Passt die Message so? Wenn du möchtest, kann ich auch direkt committen —
> sag mir einfach Bescheid."

Diskutiere den Vorschlag, passe ihn auf Wunsch an, und warte auf eine
explizite Anweisung wie:
- "Ja, committen"
- "Mach den Commit"
- "Commit so"

---

## Phase 5: Commit ausführen (nur auf explizite Anweisung)

> [!IMPORTANT]
> Diese Phase wird **nur ausgeführt**, wenn der User explizit sagt, dass
> committet werden soll. Nie von selbst committen.

Nutze den Heredoc-Ansatz um Subject und Body korrekt zu setzen:

```bash
git commit -F - << 'EOF'
<subject>

<body>
EOF
```

Nach dem Commit: kurz bestätigen welcher Hash erstellt wurde (`git log -1 --oneline`).

---

## Regeln

- **Sprache des Subjects**: Englisch (passend zu den bestehenden Commits im Repo).
- **Sprache des Bodys**: Englisch (konsistent).
- **Länge Subject**: max. 72 Zeichen.
- **Keine Trivialitäten im Body**: "Changed Dockerfile" ist trivial — "Avoids installing all workspace dependencies in every container" ist wertvoll.
- Falls der Transcript nicht hilfreich ist (z.B. weil die Änderungen offensichtlich sind), ist ein Body optional — lass ihn dann weg statt Fülltext zu schreiben.
- **Kein Commit ohne Freigabe** — immer erst Phase 4 abschließen.
