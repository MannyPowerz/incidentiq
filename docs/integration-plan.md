# IncidentIQ — Integration Plan

**Purpose:** every seam between components, who owns each side, what crosses it, and in what order it all comes together.
**Team:** Manny, Anthony. Gabriella has left; her collector and her UI branch are reassigned below.
**Target:** coding starts Sat Sep 5, code freeze Fri Oct 2, demo Fri Oct 9. See `schedule.md`.
**Companions:** `agent-architecture.md`, `architecture.md`, `contracts.md`

---

## 1. Where everything is right now

`main` is at `ad0c2ed`, the merge of PR #18, **August 8.** Nothing has merged in three weeks.

| Piece | Location | Owner | State |
|---|---|---|---|
| Auth, incidents, timeline, fingerprints | `main` | Manny | done, 42 tests |
| Socket rooms + persist | `main` | Anthony | done |
| Socket history replay, event rename | PR #19 | Anthony | approved, unmerged |
| Relevance scoring + roster + path map + `.mailmap` | PR #20 | Manny | open, 79 tests |
| AI brain (`draftFromContext`) | PR #21 | Manny | open, 49 tests |
| ADR 0014 (confirm flow) | PR #22 | Manny | open, docs only |
| Timeline enum fix | PR #23 | Manny | open |
| Room details page + timeline tab | `feat/room-details-page` | **was Gabriella** | 1,618 lines, never PR'd |
| AI delivery half + confirm endpoint | Anthony's machine | Anthony | "done," not pushed |
| Reason generator | Anthony's machine | Anthony | "done," not pushed |
| **Collector** | nowhere | **was Gabriella → Manny** | not started |
| **Step 8 glue** | nowhere | **→ Anthony** | not started |
| **Agent** | nowhere | **→ Anthony (bulk), Manny (auth ADR)** | not started |
| **Client wiring** | nowhere | **→ Manny** | client has zero API calls |

## 2. Merge order

Dependency-ordered. Each step is a prerequisite for the next branch to rebase cleanly.

```
1. #19  socket.io          — independent, approved, go first
2. #23  enum fix           — independent, tiny, go second
3. #21  ai-brain           — independent; brings server/src/ai to main
4. #20  relevance          — independent; brings server/src/relevance to main
5. #22  ADR 0014           — docs only, any time after #21
6. feat/room-details-page  — Manny opens the PR himself; Gabriella's work, needs
                             rebase onto main after #19 (both touch timeline types)
7. Anthony's delivery PR   — AFTER #21 is on main, branch off main
8. Anthony's reason PR     — AFTER #20 is on main, branch off main
```

**Why Anthony waits for 3 and 4:** neither `server/src/ai` nor
`server/src/relevance` exists on `main`. If he branches off `main` today his
delivery half has no `draftFromContext` and his reason generator has no
`TeammateScore`. Branch off `feat/ai-brain` / `feat/relevance-scoring` now, or
off `main` after Wednesday. Not before.

**Anthony reviews #20–#23.** Manny cannot approve his own PRs. This is the
first task in the schedule because everything else queues behind it.

## 3. Client ↔ Server — three things that will break on day one

Verified against `main`:

- **No CORS.** No `cors` package on Express. `new Server(server)` with no
  options on Socket.io. Vite serves on `:5173`, the API is on `:3000`. Every
  fetch and the socket handshake will be rejected by the browser.
- **`sameSite: 'strict'` on the refresh cookie.** Even with CORS, a browser
  will not send that cookie cross-origin. `/auth/refresh` could never receive
  it.
- **`socket.io-client` is not a client dependency.** It's in server devDeps for
  tests only.

### 3.1 The fix: Vite proxy, not CORS

One block in `client/vite.config.ts` makes the client same-origin in
development, which resolves all three at once:

```ts
server: {
    proxy: {
        '/auth':         'http://localhost:3000',
        '/incidents':    'http://localhost:3000',
        '/fingerprints': 'http://localhost:3000',
        '/socket.io':    { target: 'http://localhost:3000', ws: true }
    }
}
```

The browser talks to `:5173` for everything. Vite forwards. Cookies are
same-origin, no CORS headers needed, socket upgrades pass through with
`ws: true`. **This is the first UI task and nothing else in the client can be
tested until it lands.**

`npm i socket.io-client` in `client/`. Add `VITE_API_URL` to `client/.env`
for the non-proxied production case, but the demo runs through the proxy.

### 3.2 Access token in the client

Keep it **in memory** (a module-level variable or React context), not
`localStorage`. On `401 token_expired` from any call, hit `/auth/refresh`, store
the new token, retry once. On any other 401, route to sign-in. This is exactly
the client behaviour `middleware.ts` was designed for — the distinct
`token_expired` code exists so the client can refresh silently instead of
bouncing the user.

**The route guard rides on the same state.** Every page except sign-in and
register checks for a token in memory before rendering; no token means an
immediate redirect to sign-in, not a blank page or a crash. This was a
separate "Application Layout" line item on the original board — it's folded
in here because it's the same in-memory token being checked, not new state.
Without it, opening a direct link to a room with no session is broken, and
that will happen live the first time someone refreshes mid-demo.

### 3.3 Which pages talk to what

| Page (exists, mocked) | Endpoint | Notes |
|---|---|---|
| `SignInPage` / `AuthForm` | `POST /auth/login`, `POST /auth/register` | token → memory, cookie set by server |
| `RoomsPage` | `GET /incidents`, `POST /incidents` | replaces `data/rooms.ts` |
| `RoomDetailsPage` (branch) | `GET /incidents/:id`, `GET /incidents/:id/timeline` | timeline tab already built |
| `RoomDetailsPage` timeline | `POST /incidents/:id/timeline` | post entry |
| `RoomDetailsPage` timeline | socket: `join-room`, `new-message`, `send-history` | **after #19**: `join-room` takes `{ incidentId, sinceId? }`, not a bare number |
| `RoomDetailsPage` timeline | `PATCH /incidents/:id/timeline/:entryId/confirm` | **Anthony's delivery PR** — confirm button on `ai_draft` entries where `author_id` is null |
| `RoomDetailsPage` timeline | relevance ordering | §6 |
| `DashboardPage` | — | **not wired for MVP** — scope cut |

**`affected_system` becomes a dropdown** in `CreateRoomModal`, populated from
the keys of `SYSTEM_TO_PATHS` (§9). Free text is what makes relevance score
nobody.

## 4. Agent ↔ Server — the draft endpoint

The agent posts an approved detection. Data flow says step 5 → step 6 (AI
draft) → step 7 (DB). The agent needs one endpoint that does 6 and 7.

**Every call the agent makes uses `Authorization: AgentKey <key>`, not a
Bearer JWT.** Decided in ADR 0016 — Dedicated Agent Credentials, not a
password or a pasted token. `requireAgentKey` populates `req.user` in the
same shape `requireAuth` does, so every route below needs no change to accept
either.

**Before creating an incident, the agent checks for one to reuse.** Decided
in ADR 0017. `GET /incidents?affected_system=X` first; if an open one exists,
post the draft onto it via the route below instead of creating a new
incident. This only changes the agent's own client logic — `POST /incidents`
itself is unchanged for human callers.

**Proposed, in Anthony's delivery PR:**

```
POST /incidents/:id/draft
  requireAuth, validateBody
  body: { context: string, kind: 'scanner' | 'log' }
  →  calls draftFromContext({ incidentId, context, kind })
  →  insertTimelineEntry(incidentId, null, 'ai_draft', draft)   author_id NULL per ADR 0014
  →  step 8 (§5)
  →  broadcast
  ←  201 { entry }
  errors: AiDraftProviderError → 502, AiDraftValidationError → 502, incident not yours → 404
```

Agent flow becomes: `POST /incidents` (creates the room) → `POST
/incidents/:id/draft` (AI drafts from the signature's explanation). Two existing
patterns, one new route.

**If Anthony built it differently, the agent's `client.ts` follows his shape.**
This section is a proposal so the two sides have something concrete to agree
on before either is written. **Decide by Fri Sep 11.**

The confirm endpoint from ADR 0014 lives in the same PR:

```
PATCH /incidents/:id/timeline/:entryId/confirm
  requireAuth
  UPDATE timeline_entries SET author_id = $user
    WHERE id = $entryId AND incident_id = $id AND type = 'ai_draft' AND author_id IS NULL
  ← 200 { entry } | 404 if no row matched (not found, not yours, or already confirmed)
```

## 5. Step 8 — the glue nobody owned

`architecture.md` step 8: *"Server calls relevance engine → scores each teammate
against this entry."* No code does this. It sits between three finished pieces.

### 5.1 What it does

After any timeline entry is written, before broadcast:

```
collectTouches(repoPath, filePaths)        → CommitTouch[]      Manny's collector
findTeamRoster(orgId)                      → TeamMember[]       exists, PR #20
resolveFilePaths(incident.affected_system) → string[]           exists, PR #20
scoreTeammates(touches, roster, ctx, now)  → TeammateScore[]    exists, PR #20
for each: reasonFor(score)                 → string             Anthony's generator
```

### 5.2 Where it lives

One function, `server/src/relevance/scoreEntry.ts`:

```ts
export async function scoreEntry(
    entry: TimelineEntry,
    incident: Incidents
): Promise<ScoredTeammate[]>
```

Called from **three** places — anywhere an entry is written:
`timeline/routes/create.ts`, `Socket/socketHandlers/emittingMessages.ts`, and
the new `draft` route. One function, three callers, so the behaviour cannot
drift between REST and socket.

### 5.3 The type it returns

Additive to the contract per ADR 0011:

```ts
// relevance/types.ts
export interface ScoredTeammate extends TeammateScore {
    reason: string;   // Anthony's ReasonFor output
}
```

### 5.4 How it reaches the browser

**Attach to the broadcast payload.** `io.to(room)` sends one payload to
everyone in the room, so per-teammate ordering cannot happen server-side in the
emit. Instead:

```ts
io.to(room).emit('new-message', { entry, relevance: ScoredTeammate[] })
```

Each client finds its own `user_id` in `relevance`, reads its own `score` and
`reason`. For a three-person team the payload grows by a few hundred bytes.
This is the simplest thing that satisfies step 10 with no new table and no
per-socket emits.

**The `new-message` payload shape changes.** It was `TimelineEntry`; it becomes
`{ entry, relevance }`. This is a contract change to `ServerToClient` in
`socketTypes.ts` and the client must be built against the new shape from the
start. **Anthony makes the type change in the step 8 PR; Manny wires the client
to it.**

### 5.5 Reconnect and GET

`GET /incidents/:id/timeline` returns rows from Postgres, which carry no
relevance. Two options: persist scores, or recompute. **Recompute.**
`architecture.md` calls relevance a stateless helper, and persisting would mean
a table, a schema change, and a staleness question. `handleListTimelineEntries`
calls `scoreEntry` per entry and returns `{ entries: [{ entry, relevance }] }`.
Same shape as the socket, so the client has one renderer.

Cost: one `git log` per entry per GET. For a small repo that's tens of
milliseconds each. Cache `collectTouches` output for 60 seconds keyed on
`(repoPath, filePaths)` if it shows up in the demo; do not build the cache
until it does.

### 5.6 The one new config value

`RELEVANCE_REPO_PATH` — the git repo the collector runs against. For the demo
it is this repo (dogfooding). Add to `server/.env.example`. `scoreEntry`
returns `[]` and logs once if the path doesn't exist or isn't a git repo, so a
misconfigured server still serves entries, just unranked.

## 6. Step 10 — ordering in the UI

Each client, on receiving `{ entry, relevance }`:

1. `mine = relevance.find(r => r.user_id === currentUser.id)`
2. Store `entry` with `mine.score` and `mine.reason`
3. Render the timeline **sorted by `entry.id` as the primary order** — the
   database sequence is absolute per ADR 0001 — with relevance shown as a
   badge/line under each entry, **not** as the sort key

**Read that last point twice.** `architecture.md` step 10 says "ordered by
their relevance score," but ADR 0001 says timelines sort by `(incident_id,
id)`, never anything else, and `build-plan.md` line 29 says "relevant posts
surface at top of each developer's view." Those reconcile as: **chronological
timeline, plus a "relevant to you" section at the top** showing the N highest
scoring entries. The timeline itself never reorders. That's the Minimum for
"Personalized Interface" and it doesn't fight the ordering invariant.

**All-zero case.** When nobody has touched the files — new module, or
`affected_system` didn't map — every score is 0. The reason generator must
return a real sentence for this (Anthony, ADR 0011 open question 2). The UI
shows it under the entry like any other reason. No special empty state.

## 7. The collector — spec for Manny

Was Gabriella's. The contract is `CommitTouch` in `relevance/types.ts`;
the decisions are ADR 0011 and 0012. What's left is the implementation.

```ts
// relevance/collector.ts
export async function collectTouches(
    repoPath: string,
    filePaths: string[]
): Promise<CommitTouch[]>
```

```
git log
  --no-merges                              ADR 0011: merges credit the merger with every file
  --date=iso-strict
  --format=COMMIT%x00%aE%x00%aI%x00%s      %aE not %ae — mailmap-resolved, or .mailmap does nothing
  --name-only
  -- <filePaths...>                        pathspec: let git filter, scorer filters again anyway
```

Parse: each `COMMIT` line is followed by the touched file paths until the next
`COMMIT`. One `CommitTouch` per (commit, file). `committed_at` from `%aI` —
**author date, not commit date**, because rebasing rewrites commit dates
(ADR 0011).

`execFile('git', [...])`, never `exec` — no shell, no injection surface from
a path.

Empty repo, no matching paths, or a path outside the repo → `[]`, not a throw.

Tests, per ADR 0015: run against **this repo's real history** with a fixed
`filePaths`, assert shape and that no merge commit appears. Mutate `%aE` to
`%ae` — the `.mailmap` test must fail. Mutate away `--no-merges` — the merge
test must fail.

## 8. Seed data

The demo starts from an empty database every time `TRUNCATE` runs. It needs:

- One org (`Demo Team`, already seeded by migration 0001)
- **Two users whose emails match git authors** — `mannysmart35@gmail.com` and
  Anthony's, so relevance actually ranks someone. Gabriella's `.mailmap` row
  becomes moot.
- Two or three incidents with `affected_system` set to keys `resolveFilePaths`
  knows
- A handful of timeline entries so the room isn't empty

`server/scripts/seed-demo.ts`, run with `tsx`. Idempotent — check before
insert. **Anthony builds it** (he needs it to test step 8) and both use it.

## 9. `affected_system` vocabulary

It's free `TEXT`. `resolveFilePaths` only fires on an exact match. The fix is
not a schema change, it's **agreeing on the keys in one place** and having
three readers:

| reader | reads from |
|---|---|
| `relevance/systemPaths.ts` `SYSTEM_TO_PATHS` | the source of truth |
| client `CreateRoomModal` dropdown | `Object.keys(SYSTEM_TO_PATHS)` — copy the list, it's eight strings |
| agent `Detection.affectedSystem` | the same eight strings, port → system |

Current keys: `auth`, `timeline`, `incidents`, `fingerprints`, `relevance`,
`sockets`, `postgres`, `database`. Add `client` and `server` for the agent's
port mapping. **Manny adds those two keys in PR #20 before it merges.**

## 10. Demo runbook — the click-through

Two laptops or two browser profiles. Server, seed, agent, two clients.

```
SETUP (before the demo starts)
  server:  npm run migrate && npx tsx scripts/seed-demo.ts && npm run dev
  client:  npm run dev                                          → :5173
  agent:   npx tsx agent/src/index.ts                           → logs in, publishes fingerprint
  browser A (Manny):    sign in
  browser B (Anthony):  sign in, open the same room as A will

1. OPEN — the VPN catch  (build-plan line 63)
   terminal: npx tsx agent/scripts/demo-dead-port.ts
   agent:    within 30s, the private card appears
   say:      "Nothing has left this machine."
   press:    y
   browser A + B: new incident appears; an ai_draft entry appears in the room

2. THE HUMAN GATE
   browser A: the ai_draft shows a confirm button (author_id null)
   click confirm → author_id set, entry now reads as Manny's
   say:      "The agent detected, the human decided."

3. LIVE
   browser A: post an observation
   browser B: it appears without refresh
   say:      "Written to Postgres first, then broadcast. Refresh B — same order, from the DB."

4. RELEVANCE — the headline
   browser B: the "relevant to you" section shows the entry with a reason:
              "You wrote most of server/src/sockets"
   browser A: different reason, different position
   say:      "Three signals: how recently, how often, how much of it is yours.
              Ownership outweighs recency — the author beats the typo-fixer."

5. CLOSE — works-on-my-machine  (build-plan line 65)
   browser: GET /fingerprints?project=incidentiq   (a page, or just the JSON)
   two rows, two node versions, side by side
   say:      "Two machines, one diff, no GitHub API."
```

Rehearse it twice on Thu Oct 8. Time it. It should be under six minutes.

## 11. If something slips — fallbacks, decided now

| If this isn't done by Fri Oct 2 | Fallback | Cost |
|---|---|---|
| Agent | Manually `POST /incidents` + `POST /draft` with curl during the demo. Show the agent code. | Lose the opener's magic, keep the flow |
| Collector | `scoreEntry` returns a hardcoded fixture for the demo repo | Relevance shows, but it's fake — say so |
| Step 8 | Relevance section hidden; demo stops at step 3 | Lose the headline |
| AI draft endpoint | Agent posts a plain `observation` with the explanation | Lose step 6; still demonstrates detection → post |
| Confirm endpoint | Skip the confirm click; explain ADR 0014 verbally | Small |
| Room details page merge | Use `ViewRoomModal` from `main`, which exists | Uglier, works |
| UI polish | Ship it unpolished | Cosmetic |

**The collector is the one with no acceptable fallback** — a fake fixture is
a demo of nothing. That is why it's first in Manny's schedule.

## 12. Gaps closed by this plan, and gaps still open

**Closed here:**
- CORS / cookie / socket.io-client → Vite proxy (§3.1)
- No route guard → folded into token-in-memory state (§3.2)
- No draft endpoint → proposed shape (§4)
- No agent auth mechanism → Dedicated Agent Credentials, ADR 0016 (§4)
- Every detection created a new incident, no reuse → agent checks for an open one first, ADR 0017 (§4)
- Step 8 unowned → Anthony, `scoreEntry`, three call sites (§5)
- How scores reach the browser → attached to broadcast, recomputed on GET (§5.4–5.5)
- Step 10 vs ADR 0001 ordering conflict → chronological + "relevant to you" section (§6)
- `affected_system` free text → one vocabulary, three readers (§9)
- No seed data → `seed-demo.ts` (§8)
- No demo script → §10
- Collector unowned → Manny, spec in §7

**Still open, needs a decision:**
- Agent auth → ADR 0016, Manny, by Fri Sep 11 (`agent-architecture.md` §8)
- Draft endpoint shape → Anthony confirms or counter-proposes by Wed Sep 9
- Anthony's account email for `.mailmap` → any day now

**Deferred past the demo, on purpose:**
- `signatures_detected` writes and step 11 archive mining
- Indexes on `incidents.org_id` / `timeline_entries.incident_id` — 30 minutes, do it if there's slack, it's not in the demo path
- CI
- Persisting relevance scores
- Five more signatures
- Dashboard wiring — not in the Minimum demo definition, `RoomsPage` covers the post-login landing (`schedule.md` Dashboard wiring)
- Raw scanner evidence in the UI — the AI draft's text already carries it in human-readable form (`schedule.md` Raw evidence display)
- A browser view of the agent — CLI-only for the MVP, see `agent-architecture.md` §3 (`schedule.md` Agent browser view)
