# Verdale Frontend

Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Lucide. Styled with the [Verdale Design System](https://claude.ai/artifact/EPmCfi44rhHVD1Uf7JUZWZ).

> Status: M1 gave the scaffold, tokens and typed Core client. M2 adds the web shell (header, theme switch, sign-in with GitHub or Google, route guard, standard loading / error / empty states), the full design-system component set, and the Space pages (my Spaces, explore, create, overview, settings, members, invitations). M3 adds the problem editor (Markdown with live preview and maths, autosave, limits, languages, pictures), the Testcases page (one Save, Generate expected output, upload examples), reference solutions and the publish checklist, the problem list, the solving page (statement, examples, code editor, submit) and live results with a history of submissions. M3 also adds Tracks and Collections: the Space overview is a list of Tracks with progress, a Track page shows Collections and problems with the person's verdicts, owners and editors manage Tracks, Collections, members and invitations and see member progress, problems can use a PDF statement shown with pdf.js, the create page is one page with a locked slug, and profile settings show the provider's picture and edit the display name. `/design` shows every component in both themes (not linked from the app).

## Run it

```bash
cp .env.example .env.local     # CORE_API_URL, default http://localhost:8080
npm install
npm run dev                    # http://localhost:3000
```

Start Core first (see `Verdale-core-service/README.md`, which also explains running all three repos together).

## Pages

| Route                                                   | Who                                                        | What                                                                                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                     | everyone                                                   | Landing                                                                                                                                                  |
| `/login`                                                | everyone                                                   | Sign in or sign up (the same flow) with GitHub or Google                                                                                                 |
| `/explore`                                              | everyone                                                   | Search public Spaces                                                                                                                                     |
| `/spaces`                                               | signed in                                                  | My Spaces (active / archived), pending invitations                                                                                                       |
| `/spaces/new`                                           | signed in                                                  | Create a Space                                                                                                                                           |
| `/spaces/<slug>`                                        | everyone (public) / members (private)                      | Overview: the Tracks you can see, with your progress                                                                                                     |
| `/settings/profile`                                     | signed in                                                  | Picture from the sign-in provider, display name (username is fixed)                                                                                      |
| `/spaces/<slug>/tracks/<track>`                         | everyone who can see the Track                             | Collections and problems in order, progress, your verdicts                                                                                               |
| `/spaces/<slug>/problems`                               | owners and editors                                         | Every problem of the Space with its status                                                                                                               |
| `/spaces/<slug>/manage`                                 | owners and editors                                         | Tracks (drag to order, archive, restore) and Collections                                                                                                 |
| `/spaces/<slug>/manage/tracks/<track>`                  | owners and editors                                         | A Track: Collections, settings and privacy, members and invitations, progress                                                                            |
| `/spaces/<slug>/manage/collections/<collection>`        | owners and editors                                         | A Collection: details, add, remove and order problems                                                                                                    |
| `/spaces/<slug>/progress`                               | owners and editors                                         | How far each solver has got in a Track                                                                                                                   |
| `/spaces/<slug>/members`                                | members; owner and administrators manage                   | Members, roles, invitations                                                                                                                              |
| `/spaces/<slug>/settings`                               | owner, administrators                                      | Name, description; owner only: visibility, handing over, archive (all confirmed)                                                                         |
| `/spaces/<slug>/problems/new`                           | owners and editors                                         | Create a problem: title and slug on top, saved as a draft on the first Save                                                                              |
| `/spaces/<slug>/problems/<problem>`                     | everyone (published) / owners and editors (draft preview)  | Statement, examples, code editor, submit, live result                                                                                                    |
| `/spaces/<slug>/problems/<problem>/edit`                | owners and editors                                         | Draft: statement editor (autosave), Verify, publish checklist. Published: update form (Minor / Major chip, Force major update, Save). Major draft banner |
| `/spaces/<slug>/problems/<problem>/edit/history`        | owners, administrators, editors, observers (view only)     | Version history: Minor / Major, forced, who, when, fields; old and new value on expand                                                                   |
| `/spaces/<slug>/problems/<problem>/edit/tests`          | staff see it; owners, administrators and editors change it | Testcases: one Save for the page; upload or paste, Visible to solvers, order, replace, remove, Generate expected output                                  |
| `/spaces/<slug>/problems/<problem>/edit/solutions`      | owners and editors                                         | Reference solutions (needed before publishing)                                                                                                           |
| `/spaces/<slug>/submissions`                            | owners, administrators, editors, observers                 | Everyone's submissions, Group by Member, Track or Problem (`?group=`), filters, search, sort and page in the URL                                         |
| `/spaces/<slug>/submissions/members/<user>[/<problem>]` | same                                                       | One member's problems, then their submissions of a problem                                                                                               |
| `/spaces/<slug>/submissions/tracks/<track>`             | same                                                       | The problems of a Track with how people got on                                                                                                           |
| `/spaces/<slug>/submissions/problems/<problem>`         | same                                                       | All submissions of a problem (`?track=` for one Track)                                                                                                   |
| `/spaces/<slug>/submissions/<id>`                       | same                                                       | Testcases (hidden ones too, char diff, long output folded), Code (copy, download, compare), Compiler output; view only                                   |
| `/spaces/<slug>/problems/<problem>/submissions`         | signed in                                                  | Your submissions of the problem (owners and editors can switch to everyone's)                                                                            |
| `/spaces/<slug>/problems/<problem>/submissions/<id>`    | author, owners and editors                                 | Full result: verdict, per-testcase table, compiler message, your code, "Check again" after a system error                                                |
| `/invites/<token>`                                      | everyone to look, signed in to answer                      | Accept or decline an invitation link                                                                                                                     |
| `/design`                                               | everyone                                                   | Component gallery for design review                                                                                                                      |

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
features/problems/   problem list, create form, editor workspace (statement, tests, solutions, publish panel), autosave hook, test-file pairing
features/submissions/ solve page, live status (Server-Sent Events with a polling fallback), result and history pages
components/ui/       base components (see "Component list" below)
components/grader/   Grader components (see "Component list" below)
components/layout/   header, theme toggle, page container, route tabs
components/markdown/ MarkdownView: GitHub Markdown plus KaTeX maths; no raw HTML, safe links, pictures only from Verdale's storage
components/code/     CodeEditor: Monaco with the Verdale themes, or a plain text box on small screens and when Monaco cannot load
components/states/   empty, error and loading states
app/components.css   component styles from the design system (vd-* classes, tokens only)
lib/monaco-themes.ts Monaco themes verdale-light / verdale-dark (hex; a test fails if they drift from the tokens)
lib/api-client.ts    typed openapi-fetch client for Core (relative URLs, proxied by next.config.ts)
lib/api.ts           unwrap(): turns a client result into data or an ApiError (status, error_code, field messages)
lib/use-api-query.ts tiny loading / error / reload hook
lib/contracts/       generated from the pinned contract, do not edit
contracts/           pinned copy of Verdale-core-service/contracts (contracts.lock.json)
```

## Component list

Every component is shown in both themes at `/design` (light panel above dark panel). Build pages from these; add to the design system first when something is missing.

| Group                | Components                                                                                                                                                                      | Notes                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Forms                | `TextField`, `Dropdown`, `Checkbox`, `RadioGroup`, `Toggle`                                                                                                                     | Radix-based, no native checkbox, radio or select left in the app. `Dropdown` options may carry a `description`; `locked` options stay in the list, disabled, with a lock and no reason text. A `Toggle` is for a setting that applies at once, or that waits for Save beside an `UnsavedBar`; a `Checkbox` is for choices submitted with a form. |
| Navigation and data  | `Breadcrumb`, `Pagination` (Showing x–y of n, Page n of m), `FilterChips`, `SortHeader`, `StatSummary`, `Tabs`, `Menu` (`MenuItem`, `MenuLabel`, `MenuSeparator`)               | Filters, sort, search, page and tab live in the URL: `useUrlQuery` and `useDebouncedText` in `lib/use-url-query.ts`.                                                                                                                                                                                                                             |
| Rows                 | `ClickableRow`, `RowText`                                                                                                                                                       | Empty space in a row runs the table's main operation; links, buttons, controls and `RowText` never do; the row's main link stays the keyboard target.                                                                                                                                                                                            |
| States               | `EmptyState`, `ErrorState` (Try again and a reference id), `Loading`, `Skeleton`, `TableSkeleton`, `Banner`, `Toast`                                                            |                                                                                                                                                                                                                                                                                                                                                  |
| Verdicts and judging | `VerdictBadge` (`full`, `short`, `auto`), `VerdictInfo`, `TestProgress` (`label` overrides the status text), `TestResultList`, `SubmissionTable`, `TestcaseList`                | Full name by default, the code where space is tight, an info popover listing every verdict.                                                                                                                                                                                                                                                      |
| Output               | `DiffView` (character diff, whitespace, ignored trailing spaces, missing and extra lines, folding, `expectedLabel`), `SampleIO`, `CodeEditorFrame`, `ProblemStatement`          |                                                                                                                                                                                                                                                                                                                                                  |
| Edit Problem         | `SortableListOf` and `SortableLists` (dnd-kit), `DragHandle`, `UnsavedBar`, `FilePreview`, `ConfirmOverwriteDialog`, `FileUploader`, `ChangeBadge`, `Dialog` (`md`, `lg`, `xl`) | Reordering is never drag only: every row also gets a more actions menu (Move up, Move down, to top, to bottom, to another list) and moves are announced to screen readers.                                                                                                                                                                       |

Reordering uses `@dnd-kit/core` 6, `@dnd-kit/sortable` 10 and `@dnd-kit/utilities` 3, the stable packages. The rewrite `@dnd-kit/react` is still 0.x and has no keyboard and announcements story as complete as the stable one, so it is not used yet.

## Design rules (from the design system)

- Use token classes, never raw hex: `bg-surface`, `text-text-muted`, `bg-primary text-on-primary`, `text-verdict-ac bg-verdict-ac-soft`; type styles are utilities such as `text-h1`, `text-prose`, `text-mono-label`.
- One primary button per view. Borders separate surfaces; `shadow-overlay` is only for things that float.
- A verdict or status is never colour alone: icon + code + label.
- Light theme first; dark follows `prefers-color-scheme` or `data-theme="dark"` on `<html>`.
- Interface copy is English (source) and Thai, sentence case, no exclamation marks. See `docs/i18n.md`. Fonts: IBM Plex Sans (+ Sans Thai for problem content), IBM Plex Mono.

## Problems and solving (M3)

- **Editing is autosaved.** The Statement tab saves a moment after typing stops, sends only what changed, shows "Saving…", "Saved at 14:05" or the error, keeps your text when a save fails ("Try again"), and the browser asks before you close the tab with unsaved changes. Mistakes Core would refuse (limits, empty title, no language) are shown beside the field and never sent.
- **The preview is the solver's page.** The editor's right-hand pane and the solving page use the same `ProblemReader`, so what you preview is what solvers get. Examples come from the sample tests.
- **Pictures** are uploaded with "Insert image" (PNG, JPEG or WebP) and inserted at the cursor. `MarkdownView` shows only pictures served by Core (`/api/v1/assets/…`) or from `NEXT_PUBLIC_ASSET_BASE_URL` (the public bucket's own domain, if you set one); any other image address is shown as a link, so an author cannot learn who reads a problem.
- **Test files** are paired by name (`1.in` with `1.out` or `.ans`, `input1.txt` with `output1.txt`, or `in/` and `out/` folders). Core checks them (UTF-8 text only, size limits, CRLF turned into LF) and its message names the file and the reason.
- **The code editor is Monaco**, loaded from the jsDelivr CDN by `@monaco-editor/react` the first time a page needs it. If it cannot load within 8 seconds (offline, blocked) a plain text box with the same behaviour (Tab, Ctrl or ⌘ + Enter) takes its place. Under 768 px wide the plain box is used from the start. Unfinished code is kept in this browser per problem and language.
- **Live results** use Server-Sent Events (`/api/v1/submissions/<id>/events`) through the same `/api/*` rewrite. A dropped connection reconnects by itself and every connection starts with the full state; after repeated failures the page polls every two seconds. A system error (ISE) is explained as not the solver's fault and can be re-checked.
- **Hidden testcases stay hidden from solvers.** A solver's result table shows a verdict, time and memory for them; only samples can show a checker message and the start of the output. Owners, administrators, editors and observers may open hidden testcases (input, expected output, diff): `DiffView` and `TestResultList` draw whatever they are given, so the page decides what each role gets and Core enforces it.

## Publish gate and versions (M4, GRD-53, GRD-118, GRD-75, GRD-119)

Design: `docs/design/update-problem.md` (designed by Claude in session, to be reviewed by Kanon).

- **Verify and publish.** A draft (first draft or Major draft) shows the checklist (every `PublishCheck`, including `limits`, `hidden_tests`, `verified`), **Verify** and **Publish** (confirm dialog). `useVerification` starts `POST …/verify` and polls `GET …/verify` every 2 s while the run is `queued` or `running` (stops when it ends or the page unmounts), then reloads the editor. The report names each failed test with its verdict (hidden ones are marked), the slowest time and the peak memory. Editing is paused while verifying (`editable` from Core). Observers read it all and see no buttons.
- **Version label** `vMajor.Minor` and the status (Draft, Verifying, Verified, Published, Archived) are in the editor header; the problem page and the list show the label. The list row only knows the problem's status (the summary carries no version status).
- **Update form** (`edit` of a published problem): edits wait for Save; the chip says Minor or Major **(expected)** from `constraints.version_fields` (`predictUpdate` in `features/problems/versioning.ts`; field names are never hard-coded twice); **Force major update** is off by default and shown checked and disabled when a Major field already changed. Save calls `POST …/updates` with `expected_version` and `force_major`; Core's outcome wins: Minor shows "Minor update, now v2.2" and applies at once, Major creates the draft and the page switches to the draft editor.
- **Edit conflict** (`VERSION_CONFLICT`): a banner with **Reload** loads the open version and keeps your edits, listing the fields that changed meanwhile.
- **Major draft**: a banner on every tab says which version solvers use and which one is the draft, with **Discard draft** (confirm). Testcases and Solutions of a published problem show **Start a Major draft** (tests and solutions changes are always Major). The draft then goes through Verify and Publish. Solvers keep the open version meanwhile.
- **Submissions** show the Major they were sent to (`v2`) and an "Outdated version" mark when `outdated`; the result is kept and not re-judged.
- Error codes of the gate (`VERIFY_BLOCKED`, `VERIFY_IN_PROGRESS`, `NO_VERIFICATION`, `VERSION_CONFLICT`, `DRAFT_EXISTS`, `NO_DRAFT`, `NOT_PUBLISHED`, `MAJOR_FIELD_LOCKED`) map to clear text in `versionErrorMessage`.

- Core decides every permission; `features/spaces/abilities.ts` only hides buttons that would fail.
