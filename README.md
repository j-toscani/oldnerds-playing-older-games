# Old Nerds Playing Older Games

Website für das Retro-Gaming-Projekt "Old Nerds Playing Older Games".

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start)
- **Runtime:** [Bun](https://bun.sh/)
- **Build Tool:** [Vite](https://vite.dev/)
- **Routing:** [TanStack Router](https://tanstack.com/router) (dateibasiert)

## 🚀 Projektstruktur

```text
/
├── public/
│   ├── styles/
│   │   └── globals.css
│   ├── favicon.ico
│   └── favicon.svg
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   └── index.tsx
│   └── router.tsx
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 🧞 Befehle

Alle Befehle werden im Projektverzeichnis ausgeführt:

| Befehl            | Aktion                                  |
| :---------------- | :-------------------------------------- |
| `bun install`     | Dependencies installieren               |
| `bun run dev`     | Dev-Server starten auf `localhost:3000`  |
| `bun run build`   | Produktions-Build erstellen             |
| `bun run start`   | Produktions-Server starten              |

## Lizenz

Siehe [LICENSE](./LICENSE).
