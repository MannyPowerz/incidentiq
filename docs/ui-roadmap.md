# IncidentIOQ — UI Roadmap

**Status:** proposed 2026-10-08, against `main` @ `bd42ee2` (PR #34 merged).
**Companion docs:** `design-system.md` (tokens, primitives), `api-layer.md` (the functions every screen calls).

**A date fact, stated plainly:** `schedule.md` set the demo for Oct 9 with a fallback of Oct 16. Today is Oct 8. The frontend tasks below are the same tasks `schedule.md` already names (*Wire rooms list*, *Wire room details*, *Wire live updates*, *Confirm button*, *Relevant-to-you section*, *Fingerprint comparison*) — this roadmap sequences and scopes them; it does not re-date them. Re-dating is a schedule.md edit, separate from this.

## 1. Gap table

What exists on `main` today, screen by screen. "Exists" means a component renders; it does not mean it works against the server.

| Screen | MVP? | Exists | Data today | Endpoint(s) it needs | Loading / Empty / Error states |
|---|---|---|---|---|---|
| Sign-in / register | yes | **yes, working** — `pages/SignInPage.tsx` + `components/auth/AuthForm.tsx` | real (`client/src/auth/api.ts`) | `POST /auth/register`, `/auth/login`, `/auth/refresh` | loading ✓ (button), error ✓ (field + submit), empty n/a |
| Route guard | yes | **yes, working** — `auth/RequireAuth.tsx` | real | `POST /auth/refresh` | checking ✓, redirect ✓ |
| Rooms list | yes | renders — `pages/RoomsPage.tsx`, `components/rooms/*` | **mock** — `data/rooms.ts` (9 hardcoded rows, string ids like `ROOM-0001`) | `GET /incidents` | **none** of the three |
| Create room | yes | renders — `components/rooms/CreateRoomModal.tsx` | **mock** — appends to local state; fields `description`, `assignee` don't exist server-side; severity default `"Medium"` is not a valid value (2 of the 8 tsc errors) | `POST /incidents` | **none** |
| Room details — header + overview | yes | renders — `pages/RoomDetailsPage.tsx`, `components/roomDetails/*` | **mock** — `data/rooms.ts`; compares status to `"Resolved"` / `"Investigating"` (capitalised, 6 of the 8 tsc errors) | `GET /incidents/:id` | **none** |
| Room details — timeline | yes | renders — `components/roomDetails/tabs/RoomTimeline.tsx` | **mock** — `data/timelineEvents.ts`; shape has `title`/`description`/`author` strings, server has `body` JSONB + `author_id` number | `GET /incidents/:id/timeline`, `POST …/timeline` | **none** |
| Room details — live updates | yes | **no** — `socket.io-client` is installed, imported nowhere in `client/src` | — | Socket: `join-room`, `new-message`, `confirm-draft`, `reject-draft`, `?since=` gap-fill | — |
| Room details — AI draft (request, confirm, reject) | yes | renders static — `components/roomDetails/tabs/RoomAIAnalysis.tsx` | **mock** — `data/aiAnalysis.ts` | `POST /incidents/:id/ai-draft`, `PATCH …/timeline/:entry_id/confirmed`, `DELETE …/timeline/:entry_id/rejected` | **none** |
| Room details — "relevant to you" | yes | **no** | — | **does not exist** — `server/src/relevance/` is scoring maths only, never called from a route; no collector feeds it | — |
| Fingerprint comparison | yes | **no** | — | `GET /fingerprints?project=` (real) | — |
| Dashboard | **no** (deferred, schedule.md "Dashboard wiring") | renders — `pages/DashboardPage.tsx`, `components/dashboard/*` | mock | `GET /incidents` | **none** |
| Raw evidence panel | no (deferred) | no | — | — | — |
| Agent browser view | no (deferred) | no | — | — | — |

**Reading the table:** two screens work (sign-in, guard). Every other MVP screen either renders mock data in a shape the server does not produce, or does not exist. The mock shapes are the real problem — `Room.id` is a string, `Incident.id` is a number; `Room.assignee` and `Room.description` have no server column; `TimelineEvent.title` does not exist, the server has `body: Record<string, unknown>`. This is why "wire the existing screens" is not an option and replace-in-place is.

## 2. Build order

Main screens first; backend-dependent screens in the order their endpoints are ready. One item = one branch = one PR, merged before the next starts. Each item names the old files it deletes **in the same change**, so no route is ever dark.

### Item 0 — Foundations (no visible change)

**Scope:** `client/src/styles/tokens.css` + `reset.css` from `design-system.md` §2, imported in `main.tsx`. The primitives in §3 under `client/src/components/ui/`. The API layer skeleton from `api-layer.md`: `client/src/api/types.ts`, `client.ts`, one module per endpoint group, `fixtures/`. Fix the ESLint config so it matches `.ts/.tsx` (today it matches zero files — `npm run lint` is silent).
**Endpoint:** none.
**Deletes:** nothing.
**Done when:** `tsc` reports exactly the same 8 pre-existing errors and no new ones; every primitive has a test for its states (Vitest + Testing Library, same setup as `auth/`); `npm run lint` reports on real files; `npm test` green.
**Why first:** every later item imports from here. Doing it inside Item 1 means Item 1 ships half a design system.

### Item 1 — Sign-in reskin

**Scope:** restyle `SignInPage` and `AuthForm` on tokens and primitives. **Logic untouched** — `AuthForm.tsx` keeps its state, validation, and `login`/`register` calls exactly as merged in #34.
**Endpoint:** auth (real, already wired).
**Deletes:** `pages/SignInPage.css`, `components/auth/AuthForm.css` contents replaced (files stay, raw values go).
**Done when:** the 31 auth tests still pass unchanged; zero raw hex in the two CSS files; checked at 375 and 1440.
**Why here:** lowest risk, first screen anyone sees, proves the tokens on a real page before the bigger rebuilds.

### Item 2 — Rooms list + create room *(schedule.md: "Wire rooms list")*

**Scope:** new `pages/RoomsPage.tsx` reading `listIncidents()`; a list of rooms as a `Table` (cards on phone) showing title, severity `Badge`, status `Badge`, `affected_system`, `created_at` (via the existing `utils/formatRelativeTime.ts`); a `CreateRoomModal` posting `createIncident()` with fields **title, severity (Select P1–P4), affected_system (Select)**. The `affected_system` options are the keys of `SYSTEM_TO_PATHS` in `server/src/relevance/systemPaths.ts` — `auth, timeline, incidents, fingerprints, relevance, sockets, postgres, database, client, server` — copied into the client as a constant with a comment pointing at the source. Free text is what makes relevance score nobody. Loading, empty ("No rooms yet — create one"), error states. New room appears in the list without a refresh.
**Not in scope** (schedule.md scope cut): filters, search, the "view room" modal. Filters that exist today are mock-only and are deleted, not ported.
**Endpoint:** `GET /incidents` → `{ incidents }`, `POST /incidents` → `201 { incident }`.
**Deletes:** `pages/RoomsPage.tsx`/`.css`, all of `components/rooms/` (RoomRow, RoomsTable, RoomsCard, RoomsFilters, RoomsFooter, RoomsHeader, RoomsEmptyState, RoomActions, CreateRoomModal, ViewRoomModal, SeverityBadge, StatusBadge + their CSS), `data/rooms.ts`, `types/room.ts`.
**tsc:** removes 4 of the 8 errors (`CreateRoomModal.tsx` ×2, `RoomActions.tsx` ×2) by deleting the files.
**Done when:** create a room in the UI → it is in `GET /incidents` → it is in the list without refresh; all four states render; 375 + 1440.

### Item 3 — Room details: header + timeline *(schedule.md: "Wire room details")*

**Scope:** new `pages/RoomDetailsPage.tsx` reading `getIncident(id)` and `listTimeline(id)`. Header: title, severity, status, affected_system, created_at, and a **Resolve** button calling `resolveIncident(id)` (the only transition the server accepts today — `resolve.ts` returns `400 unsupported_status` for any other status). Timeline: entries oldest-first **sorted by `entry.id` ascending** (ADR 0001 — never by arrival time), each with its type colour rule, author (see note), relative time, and `body` rendered per type. Post-entry form: `Select` type (observation / action / finding — `ClientPostableTypes`), `Textarea` body. Loading, empty ("No entries yet"), error.
**Author display note:** entries carry `author_id: number | null`, and there is no `GET /users` endpoint. Render `author_id === null` as "System" / "AI draft" by type, and a human author as "You" when `author_id` matches the token's `sub`, else `User #<id>`. A name lookup is a backend item, not a UI one — recorded here so it is not forgotten. [uncertain: whether `GET /incidents/:id` could be extended to include a `members` list; that is a server question.]
**Endpoint:** `GET /incidents/:id`, `PATCH /incidents/:id`, `GET /incidents/:id/timeline`, `POST /incidents/:id/timeline`.
**Deletes:** `pages/RoomDetailsPage.tsx`/`.css`, all of `components/roomDetails/` (RoomHeader, RoomTabs, Banner, tabs/RoomOverview, RoomTimeline, RoomAIAnalysis + CSS), `data/timelineEvents.ts`, `data/aiAnalysis.ts`, `types/timelineEvent.ts`, `types/aiAnalysis.ts`. `utils/formatDateTime.ts` and `utils/formatRelativeTime.ts` are kept if the new page uses them, deleted if not — decided at build time, not before.
**tsc:** removes the last 4 errors (`RoomOverview.tsx` ×4). After this item `tsc` is clean for the first time.
**Done when:** open a room → see its timeline → post an entry → it appears → refresh → same order; resolve works; all four states; 375 + 1440.

### Item 4 — Live updates *(schedule.md: "Wire live updates")*

**Scope:** `client/src/api/socket.ts` (see `api-layer.md` §4). On entering a room: connect with the in-memory token, `join-room` with `{ incidentId, sinceId: <highest id already loaded> }`, append `new-message` entries **inserted by id, not pushed** (ordering invariant), apply `confirm-draft` / `reject-draft` in place. Leave the room on unmount. Reconnect → re-join with the new `sinceId` so the gap is filled from `GET …/timeline?since=`. One polite live-region announcement per arrival.
**Endpoint:** Socket.IO events listed above; `GET …/timeline?since=` for gap-fill.
**Deletes:** nothing — Item 3's page gains a hook.
**Done when:** two browsers on the same room; post in one, appears in the other without refresh; kill and restore the server; the client catches up without duplicates.

### Item 5 — AI draft: request, confirm, reject *(schedule.md: "Confirm button")*

**Scope:** in the room page, a "Draft from context" action: `Textarea` (mono) for pasted log or scanner output, `kind` select (`log` / `scanner`), calls `requestAiDraft()`. The returned `ai_draft` entry renders with the brand-orange rule, `summary` / `why_it_matters` / `likely_fix` laid out, and two buttons: **Confirm** → `confirmAiDraft()` (entry becomes the caller's, rule colour drops to normal) and **Reject** → `rejectAiDraft()` (entry removed). The same entry arriving over the socket (Item 4) must not render twice. Error states for `504 upstream_error` ("the AI provider did not answer") and `409 already_approved` / `entry_state_changed` ("someone else got there first — refreshing").
**Endpoint:** `POST /incidents/:id/ai-draft` → `201` entry; `PATCH …/:entry_id/confirmed` → `200` entry; `DELETE …/:entry_id/rejected` → `200` entry.
**Deletes:** nothing (RoomAIAnalysis went in Item 3).
**Done when:** draft → confirm → the entry shows as yours and `author_id` is set in the DB; draft → reject → gone; both broadcast to a second browser.

### Item 6 — "Relevant to you" *(schedule.md: "Relevant-to-you section")* — **FIXTURE-BACKED**

**Scope:** under each timeline entry, one line: the most-relevant teammate and a plain-English reason (`build-plan.md` Minimum tier: "flag the one most-connected teammate per post with plain English reason"). Reads `getRelevance(incidentId, entryId)` from `api-layer.md` — which today returns a typed fixture because **no endpoint exists**: `server/src/relevance/` is tested scoring maths with no route, no collector, and `reason` was never written. The UI is built to the `TeammateScore` + reason shape in `server/src/relevance/types.ts` so the swap later is one function body.
**Endpoint:** none yet. Target shape documented in `api-layer.md` §3.
**Deletes:** nothing.
**Done when:** every entry shows a relevance line from the fixture; the fixture file carries `// FIXTURE: replace when GET /incidents/:id/timeline returns relevance`; the zero-score case ("nobody has touched these files") renders a real sentence, not blank.

### Item 7 — Fingerprint comparison *(schedule.md: "Fingerprint comparison")*

**Scope:** a page listing every fingerprint for a project side by side: `published_by`, `node_version`, `os_arch`, `lockfile_hash` (mono, truncated with full value on hover/focus), `applied_migrations` (mono list). Cells that differ from the first row are highlighted — the "works on my machine" diff is the demo closer (`build-plan.md`). Project selector defaults to `incidentiq` [uncertain: the only value present in the repo is the test fixture; the agent's `.env.example` uses `AGENT_PROJECT_ID`]. Loading, empty ("Nobody has published for this project yet"), error.
**Endpoint:** `GET /fingerprints?project=` → `{ fingerprints }`. `PUT` is the agent's job; the UI does not call it.
**Deletes:** nothing.
**Route:** adds `/fingerprints` to `App.tsx` inside `RequireAuth` — **approved 2026-10-08**. Also needs a nav link; today there is no shared navigation outside the deferred Dashboard sidebar, so a minimal top bar (Rooms · Fingerprints · Sign out) is part of this item.
**Done when:** two users' fingerprints render side by side with differing cells highlighted; 375 (stacked) + 1440.

### Item 8 — Dashboard route: redirect and delete (**approved 2026-10-08**)

`/dashboard` currently renders the deferred `DashboardPage`, which `schedule.md` cut from Minimum. **Decision: redirect `/dashboard` → `/rooms`** and delete `pages/DashboardPage.*` + `components/dashboard/*` (DashboardHeader, DashboardSidebar, QuickActions, RecentIncidents, StatisticsCard, StatisticsGrid + CSS). A route that shows "Hello John" over mock stats on demo day is worse than no route. Deleting `DashboardSidebar.tsx` also removes one rename occurrence (Item 9). Can be folded into Item 2's PR since both touch `App.tsx`.
**Done when:** `/dashboard` lands on `/rooms`; `components/dashboard/` is gone; nothing imports it.

### Item 9 — Rename to IncidentIOQ *(own branch, not a UI item)*

Every tracked occurrence of the old name, from a case-insensitive scan of all tracked files on 2026-10-08. Two kinds: **display/package names** (rename) and **data values** (leave — see note).

| File | Count | Kind | Action |
|---|---|---|---|
| `server/package.json` | 1 | `"name": "incidentiq-server"` | rename |
| `agent/package.json` | 1 | `"name": "incidentiq-agent"` | rename |
| `client/package.json` | 0 | name is `"client"` | set to `incidentioq-client` while here |
| `client/src/pages/SignInPage.tsx` | 1 | logo markup `Incident<span>IQ</span>` (not caught by the scan — seen when reading the file) | rename |
| `client/src/pages/SignInPage.css` | 3 | comments/selectors | rename |
| `client/src/components/dashboard/DashboardSidebar.tsx` | 1 | brand string | rename (or deleted by Item 8) |
| `README.md` | 1 | title | rename |
| `.mailmap` | 1 | comment "incidentiq account email" | rename |
| `server/TESTING.md` | 6 | prose + container name | rename prose; container see below |
| `docs/*.md` | 19 across files | prose, ADR titles | rename prose; **do not** retitle ADRs — they are a dated record |
| `server/tests/fingerprints.queries.test.ts` | 15 | `project_id: 'incidentiq'` fixture values | **leave** — data, not a name |
| `server/tests/fingerprints.smoke.test.ts` | 7 | same | **leave** |
| `server/tests/relevance.score.test.ts` | 3 | `@incidentiq.dev` fixture emails | **leave** |
| `agent/.env.example` | 2 | `AGENT_PROJECT_ID=incidentiq`, example path | rename the path; project id is a data value — decide with the agent owner |

**Not done by this item, listed for you:** GitHub repo `MannyPowerz/incidentiq` (rename in repo Settings; GitHub redirects the old URL; then `git remote set-url origin <new>`), the Docker container `incidentiq-test-db` (local only, named in `server/TESTING.md` and your run command), Supabase project name [uncertain: never seen in the repo].

**Done when:** `git grep -i incidentiq` returns only the fixture data values and ADR titles listed as "leave"; all test suites green; `npm run dev` in each package starts under the new names.

### Item 10 — 3D hero *(last; optional; isolated)*

**Scope:** `client/src/components/hero/` — `Hero3D.tsx` (lazy via `React.lazy` + `Suspense`), `HeroFallback.tsx` (static SVG/PNG of the same shape in `--orange-500`), `Hero3D.css`. One `<Canvas>`, `frameloop="demand"` driven by a `requestAnimationFrame` loop that stops on `document.visibilitychange` hidden; a single rounded shape built from a plain `boxGeometry` with bevelled edges (**decided 2026-10-08 — no drei**), ambient + one directional light, no textures, no network-loaded assets; mouse parallax via a pointer listener on the wrapper clamped to a few degrees; `prefers-reduced-motion: reduce` → render `HeroFallback` only. Host: the sign-in page, above the form at `desktop`+, hidden at `phone`.
**Dependencies and why — two, not three:** `three` (the renderer) and `@react-three/fiber` **^9** (React 19 reconciler — v8 is React 18 only, verified against the package's peer range `react >=19 <19.4` on 2026-10-08). `@react-three/drei` is **not** added: its only use would have been `RoundedBox`, and a bevelled `boxGeometry` from `three` itself gives the same soft shape. One fewer package to own and remove.
**Bundle cost:** [uncertain — not measured]. Measuring requires installing, which Phase 1 forbids. First step of this item in Phase 2: `npm run build` before and after, compare the lazy chunk size in Vite's output table, record both numbers here.
**Removal path:** delete `client/src/components/hero/`, remove the lazy import from `SignInPage.tsx`, `npm uninstall three @react-three/fiber`, confirm `npm run build` chunk table no longer lists the hero chunk. Nothing else references these packages.
**Done when:** shape renders and rotates on sign-in at 1440; static fallback at 375 and under reduced-motion; CPU drops to idle when the tab is hidden (observable in the browser task manager); chunk size recorded above.

## 3. Sequencing summary

```
0 Foundations ─► 1 Sign-in ─► 2 Rooms ─► 3 Room details ─► 4 Live ─► 5 AI draft ─► 6 Relevant (fixture) ─► 7 Fingerprints
                                                                                                                   └─► 8 Dashboard route (ask)
9 Rename — any time after 2, own branch
10 3D hero — after 7, optional
```

Items 0–3 remove every mock file and every tsc error. Items 4–5 need only endpoints that already exist. Item 6 is the only fixture. Item 7 needs one route approval. Nothing here waits on the server.
