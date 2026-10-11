# Verdale Frontend

Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Lucide. Styled with the [Verdale Design System](https://claude.ai/artifact/EPmCfi44rhHVD1Uf7JUZWZ).

> Milestone 1 status: project scaffold, design tokens wired into Tailwind and shadcn, typed Core client from the pinned contract, and a home page that shows Core's health. The full component set is GRD-66; pages follow in M2/M3.

## Run it

```bash
cp .env.example .env.local     # CORE_API_URL, default http://localhost:8080
npm install
npm run dev                    # http://localhost:3000
```

Start Core first (see `Verdale-core-service/README.md`, which also explains running all three repos together).

## Commands

| Command                         | What                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run check`                 | Everything CI runs: ESLint, Prettier, `tsc`, Vitest, contract check                          |
| `npm run build`                 | Production build (standalone output, see `Dockerfile`)                                       |
| `npm run contracts:sync`        | Re-pin `contracts/` from `../Verdale-core-service/contracts` and regenerate the client types |
| `node scripts/build-tokens.mjs` | Regenerate `app/tokens.css` after updating `design/tokens.json`                              |

## How it is organised

Same feature-based layout as the Trailblazer frontend:

```
app/                 routes only; globals.css maps shadcn variables to Verdale tokens
app/tokens.css       generated from design/tokens.json (light and dark), do not edit
features/<name>/     api/ (pure calls, the repository), hooks/ (state, the controller), components/ (render only), types.ts
components/ui/       shadcn components restyled with Verdale tokens
lib/api-client.ts    typed openapi-fetch client for Core (relative URLs, proxied by next.config.ts)
lib/contracts/       generated from the pinned contract, do not edit
contracts/           pinned copy of Verdale-core-service/contracts (contracts.lock.json)
```

## Design rules (from the design system)

- Use token classes, never raw hex: `bg-surface`, `text-text-muted`, `bg-primary text-on-primary`, `text-verdict-ac bg-verdict-ac-soft`; type styles are utilities such as `text-h1`, `text-prose`, `text-mono-label`.
- One primary button per view. Borders separate surfaces; `shadow-overlay` is only for things that float.
- A verdict or status is never colour alone: icon + code + label.
- Light theme first; dark follows `prefers-color-scheme` or `data-theme="dark"` on `<html>`.
- Interface copy is English, sentence case, no exclamation marks. Fonts: IBM Plex Sans (+ Sans Thai for problem content), IBM Plex Mono.
