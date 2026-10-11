# Verdale Frontend

Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Lucide. Styled with the [Verdale Design System](https://claude.ai/artifact/EPmCfi44rhHVD1Uf7JUZWZ).

> Status: M1 gave the scaffold, tokens and typed Core client. M2 adds the web shell (header, theme switch, sign-in with GitHub or Google, route guard, standard loading / error / empty states), the full design-system component set, and the Space pages (my Spaces, explore, create, overview, settings, members, invitations). Problems and solving come in M3. `/design` shows every component in both themes (not linked from the app).

## Run it

```bash
cp .env.example .env.local     # CORE_API_URL, default http://localhost:8080
npm install
npm run dev                    # http://localhost:3000
```

Start Core first (see `Verdale-core-service/README.md`, which also explains running all three repos together).

## Pages

| Route                     | Who                                   | What                                                           |
| ------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `/`                       | everyone                              | Landing                                                        |
| `/login`                  | everyone                              | Sign in or sign up (the same flow) with GitHub or Google       |
| `/explore`                | everyone                              | Search public Spaces                                           |
| `/spaces`                 | signed in                             | My Spaces (active / archived), pending invitations             |
| `/spaces/new`             | signed in                             | Create a Space                                                 |
| `/spaces/<slug>`          | everyone (public) / members (private) | Overview                                                       |
| `/spaces/<slug>/members`  | members; owners manage                | Members, roles, invitations                                    |
| `/spaces/<slug>/settings` | owners                                | Name, description, visibility (confirmed), archive (confirmed) |
| `/invites/<token>`        | everyone to look, signed in to answer | Accept or decline an invitation link                           |
| `/design`                 | everyone                              | Component gallery for design review                            |

**Sign-in is a browser navigation**: the login buttons are plain links to Core (`/api/v1/auth/oauth/<provider>/start`), which redirects to the provider and back. Core needs the OAuth apps configured (`Verdale-core-service/docs/auth.md`). **Route guard**: `proxy.ts` sends visitors without a session cookie to `/login?next=…` before a protected page renders; it only checks that the cookie exists. Core validates the session on every call, and pages also react to a 401. Buttons a role cannot use are hidden (`features/spaces/abilities.ts` mirrors Core's permission table) but Core is always the one that decides.

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
components/ui/       base components (Button, TextField, Select, Tabs, Badge, Avatar, Tooltip, Toast, Dialog, Pagination)
components/grader/   Grader components: VerdictBadge, TestProgress, TestResultList, SubmissionTable, ProblemStatement, SampleIO, CodeEditorFrame, DiffView
components/layout/   header, theme toggle, page container, route tabs
components/states/   empty, error and loading states
app/components.css   component styles from the design system (vd-* classes, tokens only)
lib/monaco-themes.ts Monaco themes verdale-light / verdale-dark (hex; a test fails if they drift from the tokens)
lib/api-client.ts    typed openapi-fetch client for Core (relative URLs, proxied by next.config.ts)
lib/api.ts           unwrap(): turns a client result into data or an ApiError (status, error_code, field messages)
lib/use-api-query.ts tiny loading / error / reload hook
lib/contracts/       generated from the pinned contract, do not edit
contracts/           pinned copy of Verdale-core-service/contracts (contracts.lock.json)
```

## Design rules (from the design system)

- Use token classes, never raw hex: `bg-surface`, `text-text-muted`, `bg-primary text-on-primary`, `text-verdict-ac bg-verdict-ac-soft`; type styles are utilities such as `text-h1`, `text-prose`, `text-mono-label`.
- One primary button per view. Borders separate surfaces; `shadow-overlay` is only for things that float.
- A verdict or status is never colour alone: icon + code + label.
- Light theme first; dark follows `prefers-color-scheme` or `data-theme="dark"` on `<html>`.
- Interface copy is English, sentence case, no exclamation marks. Fonts: IBM Plex Sans (+ Sans Thai for problem content), IBM Plex Mono.
