---
description: Commit-Strategie und Berechtigungen
---

# Git Commits

Der Nutzer verwaltet Git-Commits selbst. Antigravity darf **keine** `git commit`-Befehle ausführen oder beantragen.

## Regeln

- **Keine eigenmächtigen Commits**: Führe niemals `git commit` aus ohne explizite Anweisung.
- **Kein `git push`**: Ebenso kein `git push` ohne explizite Aufforderung.
- **Staging ist erlaubt**: `git add` darf genutzt werden, um Dateien für den Nutzer zur Überprüfung vorzubereiten, wenn er es wünscht.

## Commits auf Anweisung

Commits sind erlaubt wenn der User im Rahmen des `commit-message`-Skills
(oder direkt) explizit dazu auffordert. Typische Formulierungen:

- "Ja, committen"
- "Mach den Commit"
- "Commit so"

In diesem Fall nutze den Heredoc-Ansatz:

```bash
git commit -F - << 'EOF'
<subject>

<body>
EOF
```

## Commit-Vorschläge im Fließtext

Wenn ein sinnvoller Commit-Punkt erreicht ist, darf Antigravity einen **Hinweis im Fließtext** geben — kein `run_command`-Block. Zum Beispiel:

> "Die Änderungen sind jetzt vollständig. Du könntest jetzt mit einer Nachricht wie `fix: use turbo prune + shared root Dockerfile` committen."

## Begründung

Der Nutzer möchte die volle Kontrolle über die Git-Historie behalten und selbst entscheiden, wann, was und wie committet wird.
