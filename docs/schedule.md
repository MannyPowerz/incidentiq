# IncidentIQ — Schedule to Demo

**Team:** Manny, Anthony · both full-time students, part-time work · ~8–10 h/week each, pushing
**Demo:** Friday **October 3, 2026**
**Code freeze:** Friday **September 26** — after this, only bug fixes and polish
**Fallback date if the Sep 19 checkpoint slips:** Friday October 10

Each task below is one Notion card. Copy the block, paste, done.

---

## Checkpoints — the three dates that matter

| Date | Checkpoint | If it fails |
|---|---|---|
| **Fri Sep 5** | All five PRs merged. Agent auth decided. Draft endpoint shape agreed. | Nothing else can start cleanly. Everything slides a week. |
| **Fri Sep 12** | Collector merged. Sign-in wired and timed. Agent scanner done. | Manny stalls on the 26th. Decide: extend to Oct 10 or cut relevance from the demo. |
| **Fri Sep 19** | Step 8 working in a test. VPN_LOOPBACK fires locally. Timeline wired end to end. | Cut UI polish entirely. Move demo to Oct 10. |

---

## Hours

| | Manny | Anthony |
|---|---|---|
| Week 1 · Aug 30 – Sep 5 | 9 | 8 |
| Week 2 · Sep 6 – 12 | 14.5 | 11 |
| Week 3 · Sep 13 – 19 | 10 | 13 |
| Week 4 · Sep 20 – 26 | 11 | 10 |
| Week 5 · Sep 27 – Oct 3 | 8 | 5 |
| **Total** | **~52.5** | **~47** |

Manny is heavier because he absorbed the collector and all of the UI when
Gabriella left. His agent share is one ADR. If that feels wrong, the swap is the
collector → Anthony, which flips the balance — but the collector is the critical
path and Manny wrote its contract, its two ADRs, and its README. Recommendation
is to leave it.

---

## Master list

| ID | Task | Owner | Due | Hrs | Blocked by |
|---|---|---|---|---|---|
| MQ-01 | Review and approve PRs 20, 21, 22, 23 | Anthony | Sep 2 | 3 | — |
| MQ-02 | Send account email for `.mailmap` | Anthony | Sep 1 | 0.1 | — |
| MQ-03 | Merge PRs 19, 23, 21, 20, 22 in that order | Manny | Sep 3 | 1.5 | MQ-01 |
| MQ-04 | Add `client`, `server` keys to `SYSTEM_TO_PATHS` before #20 merges | Manny | Sep 2 | 0.5 | — |
| MQ-05 | Rebase and PR Gabriella's `feat/room-details-page` | Manny | Sep 5 | 2 | MQ-03 |
| MQ-06 | Indexes migration `0005` | Manny | Sep 5 | 0.5 | MQ-03 |
| AI-01 | Confirm or counter-propose the `POST /incidents/:id/draft` shape | Anthony | Sep 3 | 0.5 | — |
| AI-02 | Open AI delivery PR (draft route + confirm route) off `main` | Anthony | Sep 5 | 2 | MQ-03, AI-01 |
| AI-03 | Open reason generator PR off `main` | Anthony | Sep 5 | 2 | MQ-03 |
| AI-04 | All-zero reason sentence | Anthony | Sep 5 | 0.5 | — |
| AG-01 | ADR 0016 — agent authentication | Manny | Sep 5 | 1.5 | — |
| AG-02 | `agent/` scaffold + `types.ts` contract | Anthony | Sep 5 | 1.5 | — |
| UI-01 | Vite proxy, `socket.io-client`, client env | Manny | Sep 4 | 2 | — |
| UI-02 | Wire sign-in and register + route guard — **timed** | Manny | Sep 8 | 4.5 | UI-01, MQ-03 |
| COL-01 | Collector — `collectTouches` | Manny | Sep 10 | 8 | MQ-03 |
| COL-02 | Collector tests, mutation-verified | Manny | Sep 12 | 3 | COL-01 |
| COL-03 | Collector PR + merge | Manny | Sep 12 | 1 | COL-02, review by Anthony |
| UI-03 | Wire rooms list + create room + `affected_system` dropdown | Manny | Sep 12 | 5 | UI-02 |
| AG-03 | Scanner — `collect()` and `probePort()` with real-socket tests | Anthony | Sep 12 | 9 | AG-02 |
| INT-01 | `seed-demo.ts` | Anthony | Sep 10 | 2 | MQ-03 |
| INT-02 | CI workflow — test on PR with Postgres service | Anthony | Sep 9 | 2 | — |
| S8-01 | `scoreEntry` + `ScoredTeammate` type + three call sites | Anthony | Sep 17 | 5 | COL-03, AI-03 |
| S8-02 | Recompute relevance on `GET /timeline` | Anthony | Sep 19 | 2 | S8-01 |
| S8-03 | Step 8 tests, mutation-verified | Anthony | Sep 19 | 2 | S8-01 |
| AG-04 | `VPN_LOOPBACK` signature + engine + tests | Anthony | Sep 17 | 7 | AG-03 |
| UI-04 | Wire room details + timeline REST | Manny | Sep 17 | 5 | UI-03, MQ-05 |
| UI-05 | Wire socket: join, live entries, history replay | Manny | Sep 19 | 4 | UI-04 |
| UI-06 | Confirm button on `ai_draft` entries | Manny | Sep 19 | 1.5 | UI-05, AI-02 |
| AG-05 | Private card + gate + debounce | Anthony | Sep 23 | 5 | AG-04 |
| AG-06 | HTTP client — login, refresh, create, draft, publish | Anthony | Sep 24 | 3.5 | AG-01, AI-02 |
| AG-07 | Run loop + `demo-dead-port.ts` | Anthony | Sep 25 | 2.5 | AG-05, AG-06 |
| REL-01 | "Relevant to you" section + reason under entries | Manny | Sep 24 | 5 | S8-01, S8-02, UI-05 |
| REL-02 | Fingerprints comparison view | Manny | Sep 25 | 2 | UI-03 |
| INT-03 | End-to-end: agent → server → both browsers | Both | Sep 26 | 4 | AG-07, REL-01 |
| INT-04 | `contracts.md` — agent section, draft route, confirm route, new socket payload | Anthony | Sep 26 | 1.5 | INT-03 |
| POL-01 | UI/UX polish pass | Manny | Oct 1 | 6 | INT-03 |
| INT-05 | Dogfood — use it daily, file bugs | Both | Sep 30 | 3 | INT-03 |
| INT-06 | Fix dogfood bugs | Both | Oct 2 | 3 | INT-05 |
| INT-07 | README — run from clean checkout | Manny | Oct 1 | 1.5 | INT-03 |
| INT-08 | Demo runbook rehearsal ×2, timed | Both | Oct 2 | 2 | INT-06 |

---

# Part: Merge Queue

### MQ-01 · Review and approve PRs 20, 21, 22, 23
**Owner:** Anthony · **Due:** Tue Sep 2 · **Est:** 3h · **Blocked by:** —
**Description:** Manny cannot approve his own PRs. Four are open: #20 relevance (79 tests), #21 AI brain (49 tests), #22 ADR 0014 (docs only), #23 enum fix (44 tests). Each PR description has a "How to test" section with exact commands and mutation checks. Run them.
**Done when:** All four show APPROVED.

### MQ-02 · Send account email for `.mailmap`
**Owner:** Anthony · **Due:** Mon Sep 1 · **Est:** 5 min · **Blocked by:** —
**Description:** Your git commits are authored as a GitHub noreply address. `.mailmap` at the repo root has a placeholder for you. Send Manny your incidentiq account email, or add the line yourself following the format at the top of the file. Until this is done you score zero on every file you've written and the relevance demo shows an empty ranking for you.
**Done when:** `git check-mailmap "<your-noreply>"` prints your account email.

### MQ-03 · Merge PRs in dependency order
**Owner:** Manny · **Due:** Wed Sep 3 · **Est:** 1.5h · **Blocked by:** MQ-01
**Description:** Order: #19 → #23 → #21 → #20 → #22. Each is independent so order is about which one you'd rather rebase if two touch the same file. After each merge, `git pull` and run the suite before the next.
**Done when:** `main` has `server/src/ai`, `server/src/relevance`, `.mailmap`, and the full suite passes on `main`.

### MQ-04 · Add `client` and `server` keys to `SYSTEM_TO_PATHS`
**Owner:** Manny · **Due:** Tue Sep 2 · **Est:** 30 min · **Blocked by:** —
**Description:** The agent maps ports to systems (`5173 → client`, `3000 → server`). Those keys must exist in `relevance/systemPaths.ts` or relevance scores nobody for agent-created incidents. Add them to PR #20 before it merges. `client: ['client/src']`, `server: ['server/src']`.
**Done when:** Both keys present, `relevance.systemPaths.test.ts` updated and passing.

### MQ-05 · Rebase and PR Gabriella's room-details branch
**Owner:** Manny · **Due:** Fri Sep 5 · **Est:** 2h · **Blocked by:** MQ-03
**Description:** `feat/room-details-page` has 1,618 lines including `RoomDetailsPage.tsx` and a timeline tab. Never PR'd. It was branched before #19, and both touch `timeline/types.ts`, so expect a small conflict. Rebase onto `main`, resolve, open the PR yourself, Anthony reviews. This is the page the entire demo runs on.
**Done when:** Merged. `client/src/pages/RoomDetailsPage.tsx` exists on `main`.

### MQ-06 · Indexes migration 0005
**Owner:** Manny · **Due:** Fri Sep 5 · **Est:** 30 min · **Blocked by:** MQ-03
**Description:** No `CREATE INDEX` exists anywhere. `incidents.org_id` and `timeline_entries.incident_id` are the filter column on every read of their tables. `0005_indexes.sql` with two `CREATE INDEX` statements. Not in the demo path — do it because it's 30 minutes and it's an interview question.
**Done when:** Migration applies cleanly on a fresh test DB; `schema.test.ts` still passes.

---

# Part: AI Delivery + Reason Generator (Anthony)

### AI-01 · Confirm or counter-propose the draft endpoint shape
**Owner:** Anthony · **Due:** Wed Sep 3 · **Est:** 30 min · **Blocked by:** —
**Description:** `integration-plan.md` §4 proposes `POST /incidents/:id/draft` taking `{ context, kind }`, calling `draftFromContext`, inserting an `ai_draft` with null author, and broadcasting. If what you built matches, say so. If not, write down what you built so the agent's HTTP client (AG-06) and the confirm button (UI-06) target the real thing. One message, one decision.
**Done when:** Manny has the endpoint path and body shape in writing.

### AI-02 · Open the AI delivery PR
**Owner:** Anthony · **Due:** Fri Sep 5 · **Est:** 2h · **Blocked by:** MQ-03, AI-01
**Description:** Branch off `main` **after** #21 merges — `server/src/ai` doesn't exist on `main` before then. Contains the draft route and the confirm route (`PATCH /incidents/:id/timeline/:entryId/confirm`, sets `author_id` where `type='ai_draft' AND author_id IS NULL`, per ADR 0014). Tests for both, including: confirm on an already-confirmed entry returns 404.
**Done when:** PR open with tests, Manny reviewing.

### AI-03 · Open the reason generator PR
**Owner:** Anthony · **Due:** Fri Sep 5 · **Est:** 2h · **Blocked by:** MQ-03
**Description:** Branch off `main` **after** #20 merges. `relevance/reason.ts` implementing `ReasonFor` from `types.ts`. The contract says it needs an answer for: every score zero, `last_touch` null, and two people scoring nearly the same. Junk subjects like `"wip"` arrive populated — filtering them is yours, not the scorer's. Tests with fixtures per ADR 0015.
**Done when:** PR open, Manny reviewing.

### AI-04 · The all-zero sentence
**Owner:** Anthony · **Due:** Fri Sep 5 · **Est:** 30 min · **Blocked by:** —
**Description:** `types.ts` lists this as unowned and blocking-to-ship: what does the reason say when nobody has touched the files? It's a real answer, not an error. Something like "Nobody on the team has worked in this area yet." Goes in AI-03. Recorded here so it isn't forgotten.
**Done when:** A test in AI-03 asserts the all-zero sentence.

---

# Part: Collector (Manny)

### COL-01 · `collectTouches`
**Owner:** Manny · **Due:** Wed Sep 10 · **Est:** 8h · **Blocked by:** MQ-03
**Description:** Was Gabriella's. Full spec in `integration-plan.md` §7. `git log --no-merges --format=COMMIT%x00%aE%x00%aI%x00%s --name-only -- <paths>` via `execFile`, never `exec`. One `CommitTouch` per (commit, file). `%aE` not `%ae` or `.mailmap` does nothing. Author date not commit date. Empty result → `[]`, never throw. **This is the critical path — everything downstream waits on it.**
**Done when:** `collectTouches(repoRoot, ['server/src/auth'])` against this repo returns real touches with no merge commits.

### COL-02 · Collector tests, mutation-verified
**Owner:** Manny · **Due:** Fri Sep 12 · **Est:** 3h · **Blocked by:** COL-01
**Description:** Per ADR 0015. Run against this repo's real history. Cases: shape is right; no merge commit appears; mailmap resolves (author a commit with the dotted email variant in a test fixture repo, or assert `%aE` behaviour against a known commit); empty paths → `[]`; nonexistent repo → `[]`. Mutations: `%aE → %ae` must fail the mailmap case; drop `--no-merges` must fail the merge case.
**Done when:** Tests pass, both mutations kill exactly their case, results in the commit message.

### COL-03 · Collector PR + merge
**Owner:** Manny · **Due:** Fri Sep 12 · **Est:** 1h · **Blocked by:** COL-02, Anthony's review
**Description:** Small PR off `main`. Add `RELEVANCE_REPO_PATH` to `.env.example`. Update the README's "three inputs" table — collector row goes from "not started" to done. Anthony reviews same day; this unblocks his S8-01.
**Done when:** Merged. **Checkpoint 2 passes.**

---

# Part: Client Wiring (Manny)

### UI-01 · Vite proxy, `socket.io-client`, client env
**Owner:** Manny · **Due:** Thu Sep 4 · **Est:** 2h · **Blocked by:** —
**Description:** Three things break the moment the client makes a real call: no CORS on Express or Socket.io, `sameSite: 'strict'` on the refresh cookie means it's never sent cross-origin, and `socket.io-client` isn't a client dep. One Vite `server.proxy` block for `/auth`, `/incidents`, `/fingerprints`, `/socket.io` (with `ws: true`) fixes all three by making the client same-origin. Exact block in `integration-plan.md` §3.1. `npm i socket.io-client`. Add `client/.env.example` with `VITE_API_URL`. **Do this first — nothing else in the client can be tested until it lands.**
**Done when:** `fetch('/health')` from the browser console on `:5173` returns `{ status: 'ok' }`.

### UI-02 · Wire sign-in and register + route guard — timed
**Owner:** Manny · **Due:** Mon Sep 8 · **Est:** 4.5h · **Blocked by:** UI-01, MQ-03
**Description:** `AuthForm` → `POST /auth/login` and `/auth/register`. Access token to memory (module variable or context), never `localStorage`. On `401 token_expired` from any later call, hit `/auth/refresh` and retry once.
Folded in from the "Application Layout" line item on the original board: a route guard wrapping every page except sign-in/register — no token in memory → redirect to `/sign-in`; has one → render. This isn't separable from the login work, since "does the redirect happen" and "does login populate the token" are tested together, and every later UI task assumes this exists.
**Time this task honestly.** It's the one data point that converts the rest of the frontend estimate from a guess into arithmetic. If it takes 6h instead of 4.5, every UI task below scales by 1.3 and you know it on Sep 8, not Sep 24.
**Done when:** Register → land on rooms page. Refresh browser → still signed in (refresh cookie works through proxy). Open `/rooms/5` in a private window with no session → redirected to sign-in, not a blank page or a crash. Write down the actual hours.

### UI-03 · Wire rooms list + create room + `affected_system` dropdown
**Owner:** Manny · **Due:** Fri Sep 12 · **Est:** 5h · **Blocked by:** UI-02
**Description:** `RoomsPage` reads `GET /incidents` instead of `data/rooms.ts`. `CreateRoomModal` posts `POST /incidents`. **`affected_system` becomes a `<select>`** populated from the eight keys in `SYSTEM_TO_PATHS` — free text is what makes relevance score nobody. Delete `data/rooms.ts` when nothing imports it. Filters and search stay on the mocked shape — **not wired for MVP**, scope cut.
**Done when:** Create a room in the UI, see it in `GET /incidents`, see it in the list without refresh.

### UI-04 · Wire room details + timeline REST
**Owner:** Manny · **Due:** Wed Sep 17 · **Est:** 5h · **Blocked by:** UI-03, MQ-05
**Description:** `RoomDetailsPage` (Gabriella's, now merged) → `GET /incidents/:id` and `GET /incidents/:id/timeline`. Post entry → `POST /incidents/:id/timeline`. Timeline renders sorted by `entry.id` ascending — the DB sequence, per ADR 0001. After S8-02 lands the GET shape becomes `{ entries: [{ entry, relevance }] }`; build the renderer to take `entry` from either shape so it doesn't break when that merges.
**Done when:** Open a room, see its timeline, post an entry, see it appear, refresh, same order.

### UI-05 · Wire socket: join, live entries, history replay
**Owner:** Manny · **Due:** Fri Sep 19 · **Est:** 4h · **Blocked by:** UI-04
**Description:** On room open: `socket.emit('join-room', { incidentId, sinceId })` — **an object after #19, not a bare number.** Listen for `new-message` (the surviving event; `entry:new` is gone) and `send-history` (array, call the ack). Track highest seen `entry.id` locally; send it as `sinceId` on reconnect. Dedupe by `id` — join-before-history means an entry can arrive twice, which is the right tradeoff but the client has to handle it.
**Done when:** Two browsers on one room. Post in A, appears in B without refresh. Kill B's network for 10s, restore, B catches up via `send-history` with no duplicates and no gaps.

### UI-06 · Confirm button on `ai_draft` entries
**Owner:** Manny · **Due:** Fri Sep 19 · **Est:** 1.5h · **Blocked by:** UI-05, AI-02
**Description:** Entries with `type === 'ai_draft' && author_id === null` show a Confirm button. Click → `PATCH /incidents/:id/timeline/:entryId/confirm`. On 200, the entry re-renders with the author set. Per ADR 0014: `type` stays `ai_draft` forever, so the entry visibly reads "AI drafted, confirmed by Manny." No edit affordance — confirm or nothing.
**Done when:** Confirm an AI draft, see the author appear, refresh, still confirmed.

---

# Part: Agent — Manny's share

### AG-01 · ADR 0016 — agent authentication
**Owner:** Manny · **Due:** Fri Sep 5 · **Est:** 1.5h · **Blocked by:** —
**Description:** A headless process needs a JWT. No document says how. Four options laid out in `agent-architecture.md` §8 with a recommendation: email + password in the agent's local config, zero server change, same threat model as `.env` holding `DATABASE_URL`. Record the recommendation or overrule it, name the upgrade path (dedicated agent tokens), name the trigger for it. **Blocks AG-06.** Number is 0016 — next free across every branch.
**Done when:** ADR merged; AG-06 has a decision to build against.

---

# Part: Agent — Anthony's share

### AG-02 · `agent/` scaffold + `types.ts` contract
**Owner:** Anthony · **Due:** Fri Sep 5 · **Est:** 1.5h · **Blocked by:** —
**Description:** New top-level `agent/` with its own `package.json` (tsx, vitest, typescript, nothing else), `tsconfig.json`, `.env.example`. Write `src/types.ts` first — `EnvSnapshot`, `PortProbe`, `Detection`, `Signature` exactly as `agent-architecture.md` §5 has them. This is the contract that lets the scanner and the signature be built without waiting on each other, same pattern as `relevance/types.ts`. One commit, push it, then start AG-03.
**Done when:** `npx tsc --noEmit` passes in `agent/`; types match §5.

### AG-03 · Scanner — `collect()` and `probePort()`
**Owner:** Anthony · **Due:** Fri Sep 12 · **Est:** 9h · **Blocked by:** AG-02
**Description:** `agent-architecture.md` §6.2. Node built-ins only. `probePort` is the real work: bound = `EADDRINUSE` on a trial listen; responsive = TCP connect **and bytes back** within the timeout — connect alone is not enough, that's the exact failure mode. **Tests use real sockets:** a `net.Server` that accepts and never writes must read as `bound: true, responsive: false`. One that echoes reads `responsive: true`. Nothing listening reads `bound: false`. A mock would hide the bug the signature exists to catch.
**Done when:** `collect(config)` returns a full `EnvSnapshot` on your machine; real-socket tests pass.

### AG-04 · `VPN_LOOPBACK` signature + engine
**Owner:** Anthony · **Due:** Wed Sep 17 · **Est:** 7h · **Blocked by:** AG-03
**Description:** `agent-architecture.md` §6.3–6.4. `engine.ts` is a ten-line map-filter over a registry. `vpnLoopback.ts` is a pure function: `bound && !responsive` fires; tunnel interface present raises severity to `critical` but **does not gate** the detection. `affectedSystem` from a port → system map using the keys in MQ-04. Three fixture tests (nothing dead → null; dead, no tunnel → warn; dead + tunnel → critical). Mutate `&&` to `||` — must fail.
**Done when:** Tests pass, mutation kills, `runSignatures(snapshot, registry)` returns a `Detection` when you run the scanner against a dead port.

### AG-05 · Private card + gate + debounce
**Owner:** Anthony · **Due:** Tue Sep 23 · **Est:** 5h · **Blocked by:** AG-04
**Description:** §6.5. `readline` from stdlib. Box-drawn card with title, explanation, and `[y/N]` — **default No**; Enter posts nothing. After any answer, suppress that `signatureId` for 10 scan intervals. In-memory map. Test the loop's y/N branching with a stubbed card; the card itself is not unit-tested.
**Done when:** Card renders for a detection; Enter does nothing and doesn't re-prompt for five minutes; `y` returns control to the loop.

### AG-06 · HTTP client
**Owner:** Anthony · **Due:** Wed Sep 24 · **Est:** 3.5h · **Blocked by:** AG-01, AI-02
**Description:** §6.7. Native `fetch`. `login()` reads `Set-Cookie` off the response and holds the refresh cookie in memory; `refresh()` sends it back as a `Cookie` header. `createIncident`, `requestDraft` (targets whatever AI-01 settled), `publishFingerprint`. On `401 token_expired` → refresh once → retry. Any other 401 → re-login once → exit. Mock `fetch` in tests; the expired-refresh-retry path is the one to pin.
**Done when:** Against a running server, `login()` returns a token, `publishFingerprint()` produces a row in `GET /fingerprints`.

### AG-07 · Run loop + demo trigger
**Owner:** Anthony · **Due:** Thu Sep 25 · **Est:** 2.5h · **Blocked by:** AG-05, AG-06
**Description:** §6.8 and §12. `index.ts`: config → login → publish fingerprint → loop every 30s: collect, republish if changed, run signatures, card for each unsuppressed, on `y` create incident + request draft. `scripts/demo-dead-port.ts`: `net.createServer(() => {}).listen(5173)` — accepts, never writes. Run it, start the agent, the card should appear within one interval.
**Done when:** The 13-item "done" checklist in `agent-architecture.md` §13 is all checked.

---

# Part: Step 8 (Anthony)

### S8-01 · `scoreEntry` + `ScoredTeammate` + three call sites
**Owner:** Anthony · **Due:** Wed Sep 17 · **Est:** 5h · **Blocked by:** COL-03, AI-03
**Description:** `integration-plan.md` §5. `relevance/scoreEntry.ts`: collector → roster → path map → `scoreTeammates` → `reasonFor` each → `ScoredTeammate[]`. `ScoredTeammate extends TeammateScore { reason: string }` added to `types.ts` (additive, per ADR 0011). Call it from `timeline/routes/create.ts`, `emittingMessages.ts`, and the draft route. **Broadcast payload becomes `{ entry, relevance }`** — update `ServerToClient['new-message']` in `socketTypes.ts`. `RELEVANCE_REPO_PATH` missing → `[]` and one log line, never a throw.
**Done when:** Post an entry via REST, the socket payload carries `relevance` with a reason for every roster member.

### S8-02 · Recompute on GET
**Owner:** Anthony · **Due:** Fri Sep 19 · **Est:** 2h · **Blocked by:** S8-01
**Description:** §5.5. `handleListTimelineEntries` calls `scoreEntry` per entry and returns `{ entries: [{ entry, relevance }] }` — same shape as the socket so the client has one renderer. Stateless, no new table. If `git log` per entry is visibly slow in the demo, cache `collectTouches` for 60s keyed on paths; **don't build the cache until it's slow.**
**Done when:** `GET /incidents/:id/timeline` returns relevance on every entry; the socket and REST shapes are identical.

### S8-03 · Step 8 tests, mutation-verified
**Owner:** Anthony · **Due:** Fri Sep 19 · **Est:** 2h · **Blocked by:** S8-01
**Description:** Per ADR 0015. Real Postgres, seeded via INT-01. Cases: every roster member gets a `ScoredTeammate`; the reason is non-empty; missing repo path → `[]` not throw; REST and socket produce the same relevance for the same entry. Mutate: drop the `reasonFor` call → the non-empty-reason case fails.
**Done when:** Tests pass, mutation kills. **Checkpoint 3 passes.**

---

# Part: Relevance UI (Manny)

### REL-01 · "Relevant to you" section + reason under entries
**Owner:** Manny · **Due:** Wed Sep 24 · **Est:** 5h · **Blocked by:** S8-01, S8-02, UI-05
**Description:** `integration-plan.md` §6. On every `{ entry, relevance }`: find your own `user_id`, keep `score` and `reason`. **The timeline stays sorted by `entry.id`** — ADR 0001 says the DB sequence is absolute and nothing reorders it. Relevance shows two ways: a one-line reason under each entry, and a "Relevant to you" block at the top of the room listing the top 3 by your score. That's `build-plan.md`'s "relevant posts surface at top of each developer's view" without fighting the ordering invariant. All-zero case renders the reason like any other — no special empty state.
**Done when:** Two browsers, same room, different users, different "Relevant to you" lists, different reasons under the same entry.

### REL-02 · Fingerprints comparison view
**Owner:** Manny · **Due:** Thu Sep 25 · **Est:** 2h · **Blocked by:** UI-03
**Description:** The demo closer per `build-plan.md` line 65: "works-on-my-machine diff between two laptops." `GET /fingerprints?project=incidentiq` returns rows with `published_by`. A simple table, one row per machine, node version and OS arch side by side, differences highlighted. Minimal — this is a read-only view of an endpoint that already works.
**Done when:** Two agents publish from two machines (or one machine with two `AGENT_EMAIL`s), the page shows both rows.

---

# Part: Integration & Demo (both)

### INT-01 · `seed-demo.ts`
**Owner:** Anthony · **Due:** Wed Sep 10 · **Est:** 2h · **Blocked by:** MQ-03
**Description:** `integration-plan.md` §8. `server/scripts/seed-demo.ts`, run with `tsx`. Idempotent. Creates two users whose emails match real git authors (yours and Manny's — this is why MQ-02 matters), three incidents with `affected_system` set to real `SYSTEM_TO_PATHS` keys, a few entries each. You need this to test S8-01; Manny needs it for every UI task from UI-03 on.
**Done when:** Run it twice on a fresh DB, second run is a no-op, `GET /incidents` returns three rooms.

### INT-02 · CI — tests on PR
**Owner:** Anthony · **Due:** Tue Sep 9 · **Est:** 2h · **Blocked by:** —
**Description:** `.github/workflows/test.yml`: Postgres service container, `npm ci`, `npm run migrate`, `npm test`. ADR 0015 is blunt that nothing enforces the test suite without this, and with eight more PRs coming in four weeks it's cheap insurance. Deferred twice already; two hours now. If it eats more than three hours, stop and defer it again.
**Done when:** A PR with a failing test shows a red check.

### INT-03 · End-to-end run
**Owner:** Both · **Due:** Fri Sep 26 — **CODE FREEZE** · **Est:** 4h · **Blocked by:** AG-07, REL-01
**Description:** The full runbook in `integration-plan.md` §10, once, together, on a call. Server + seed + agent + two browsers. Every step. Write down every place it breaks. That list is INT-06.
**Done when:** The runbook runs start to finish, or the break list is written and each item has an owner.

### INT-04 · `contracts.md` update
**Owner:** Anthony · **Due:** Fri Sep 26 · **Est:** 1.5h · **Blocked by:** INT-03
**Description:** Add: the draft route, the confirm route, the new `new-message` payload `{ entry, relevance }`, the `send-history` event, and an "Agent" section listing the five calls the agent makes. `contracts.md` is the spec a future contributor builds against; every seam that changed in this sprint has to be in it.
**Done when:** Someone could build a second client from `contracts.md` alone.

### INT-05 · Dogfood
**Owner:** Both · **Due:** Tue Sep 30 · **Est:** 3h across the week · **Blocked by:** INT-03
**Description:** `build-plan.md` Phase 4: "the team uses the app while building the app." Run the agent all day for three days. Open a room for every real thing that goes wrong. File a bug for everything that annoys you. The target build-plan names: "a number to say out loud — it caught N real failures during our own development."
**Done when:** Three days of use, a bug list, and a number.

### INT-06 · Fix dogfood bugs
**Owner:** Both · **Due:** Thu Oct 2 · **Est:** 3h · **Blocked by:** INT-05
**Description:** Whatever INT-05 surfaced, in severity order. Anything that breaks the runbook is P1. Cosmetic goes to POL-01 or gets skipped.
**Done when:** The runbook runs clean.

### INT-07 · README — run from clean checkout
**Owner:** Manny · **Due:** Wed Oct 1 · **Est:** 1.5h · **Blocked by:** INT-03
**Description:** Clone → running demo in under ten minutes for someone who has never seen the repo. Postgres setup, `.env` from `.env.example` for server, client, and agent, `npm run migrate`, seed, three `npm run dev`s. Test it on a fresh clone yourself. This is what a reviewer or interviewer opens first.
**Done when:** A fresh clone reaches the runbook's SETUP state following only the README.

### INT-08 · Demo rehearsal ×2
**Owner:** Both · **Due:** Thu Oct 2 · **Est:** 2h · **Blocked by:** INT-06
**Description:** The runbook, timed, twice, saying the words out loud. Target under six minutes. Fix anything that fumbles. Decide who drives which laptop. Have the fallback list from `integration-plan.md` §11 open in case something dies live.
**Done when:** Two clean runs under six minutes.

---

# Part: UI/UX Polish (Manny)

### POL-01 · Polish pass
**Owner:** Manny · **Due:** Wed Oct 1 · **Est:** 6h · **Blocked by:** INT-03
**Description:** **Last, on purpose.** Polishing screens before they're wired is wasted the moment wiring changes them. After INT-03 the screens are final; use the UI/UX plugin on `SignInPage`, `RoomsPage`, `RoomDetailsPage`, and the fingerprints view. Loading states, empty states, error toasts for the 400/401/404 shapes the server actually returns. **Time-boxed to 6h** — this is the first thing that gets cut if INT-06 runs long.
**Done when:** The four demo screens have loading, empty, and error states, and you're not embarrassed by them on a projector.

---

# Part: Post-MVP (deferred, not forgotten)

Three items were in the original scope and are cut here, each with a named
trigger — same move `ADR 0007` already made for the AI service, applied to the
UI split after Gabriella left. Not doing these now is a decision, not an
oversight; if you're reading this in Notion and wondering where they went,
they're here.

### PMVP-01 · Dashboard wiring
**Owner:** unassigned · **Trigger to revisit:** the Sep 19 checkpoint passes with slack left in week 4
**Description:** `DashboardPage` and its components (stats grid, recent incidents, quick actions) exist from Gabriella's work and are not in `build-plan.md`'s Minimum demo definition — the runbook never visits it, `RoomsPage` already serves as the post-login landing page. Cutting it is borrowing time from a feature above Minimum, per `build-plan.md` line 71.
**When it's picked up:** wire `GET /incidents` into the stats grid and recent-incidents list. Components already built; this is API wiring only, comparable to `UI-03`.

### PMVP-02 · Raw evidence display on AI draft entries
**Owner:** unassigned · **Trigger to revisit:** a reviewer specifically asks what the agent actually saw
**Description:** The agent's `Detection.evidence` (dead ports, tunnel interfaces — see `agent-architecture.md` §5) is not rendered anywhere. It doesn't need to be for the demo: `draftFromContext` already turns it into the AI draft's `why_it_matters` / `likely_fix` text, which is the human-readable version of the same information. A structured JSON panel would duplicate that for a technical viewer's benefit only.
**When it's picked up:** a collapsed "raw evidence" toggle on `ai_draft` entries, rendering `entry.body` fields not already shown. Small — a few hours once someone asks for it.

### PMVP-03 · Browser view of scanner activity
**Owner:** unassigned · **Trigger to revisit:** client-side work finishes early, or `signatures_detected` is being written to for another reason
**Description:** The agent is CLI-only for the MVP — the private card is a terminal prompt (`agent-architecture.md` §6.5), not a browser page. A browser-based scanner status view was implied by the original "Scanner + React" grouping but was never designed, and building it now means a new server endpoint plus new client wiring for something the demo runbook doesn't show. The terminal card is arguably the stronger demo beat — detection happening before a browser is even involved.
**When it's picked up:** a read-only page listing recent rows from `signatures_detected`, once the agent is writing to that table (it isn't yet — see `technical-audit.md` §4.5, item 5).
