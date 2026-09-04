# IncidentIQ — Technical Audit

**Audited:** 2026-08-30 against `origin/main` at `ad0c2ed` (merge of PR #18)
**Verified by:** `npx tsc --noEmit` clean, `npx vitest run` → **42 passed, 0 failed**

## Scope of this document

Sections 1, 2, and 4 describe **only what is merged to `main` and functional.**
Section 3 covers all 15 ADRs, split into merged and unmerged, because the
unmerged decisions are real and recorded even though their code is not on `main`.

**Explicitly excluded from sections 1, 2, and 4:**

| Not on `main` | Where it lives |
|---|---|
| Relevance engine (`server/src/relevance`) | PR #20, unmerged |
| AI service / LangChain (`server/src/ai`) | PR #21, unmerged |
| Socket history replay, `send-history` | PR #19, unmerged |
| Timeline enum fix | PR #23, unmerged |
| **Local agent / scanner CLI** | **never built — no branch exists** |

There is no RAG pipeline, no vector store, and no retrieval infrastructure
anywhere in this project. ADR 0008 explicitly rejects retrieval as premature.

---

# 1. Functional Execution Audit

## 1.1 REST endpoints — 13 total

All mounted in `server/src/index.ts`.

| Method | Path | Auth | Success | Failure codes |
|---|---|---|---|---|
| GET | `/health` | none | 200 | — |
| POST | `/auth/register` | none | 201 | 400, 409 |
| POST | `/auth/login` | none | 200 | 400, 401 |
| POST | `/auth/refresh` | cookie | 200 | 401 |
| POST | `/auth/logout` | cookie | 200 | — |
| POST | `/incidents` | Bearer | 201 | 400, 401 |
| GET | `/incidents` | Bearer | 200 | 401 |
| GET | `/incidents/:id` | Bearer | 200 | 401, 404 |
| PATCH | `/incidents/:id` | Bearer | 200 | 400, 401, 404 |
| POST | `/incidents/:id/timeline` | Bearer | 201 | 400, 401, 404 |
| GET | `/incidents/:id/timeline` | Bearer | 200 | 401, 404 |
| PUT | `/fingerprints` | Bearer | 200 | 400, 401 |
| GET | `/fingerprints?project=` | Bearer | 200 | 400, 401 |

`PATCH /incidents/:id` accepts the full status enum at the schema layer but
returns 400 for anything other than `'resolved'` — the only transition built.

## 1.2 Socket.io events

**Inbound (`ClientToServer`)**

| Event | Payload schema |
|---|---|
| `join-room` | `z.number()` — bare incident id |
| `sending-message` | `{ incident_id: number, type: enum, body: { summary, why_it_matters, likely_fix } }` |

**Outbound (`ServerToClient`)**

`success`, `User-joined`, `new-message`, `entry:new`, `socket-error`,
`no-incidentId`, `Invalid-org`, `no-socket-in-room`, `Invalid-Schema`,
`invalid-type`

**Known defect on `main`:** two events carry the same fact. REST
`timeline/routes/create.ts` emits `entry:new`; socket `emittingMessages.ts`
emits `new-message`. A client must listen for both. Resolved in PR #19.

## 1.3 Query modules

| Module | Functions |
|---|---|
| `auth/queries.ts` | `findUserByEmail`, `findUserById`, `findOrgIdByName`, `insertUser`, `insertRefreshToken`, `findValidRefreshToken`, `revokeRefreshToken` |
| `incidents/queries.ts` | `insertIncident`, `findIncidentById`, `findIncidentsByOrg`, `resolveIncident` |
| `timeline/queries.ts` | `insertTimelineEntry`, `findTimelineEntriesByIncident`, `findTimelineEntriesSince` |
| `fingerprints/queries.ts` | `upsertFingerprint`, `findFingerprintsByProject` |

## 1.4 Database schema — 9 tables + ledger

| Table | Migration | Purpose |
|---|---|---|
| `orgs` | 0001 | tenant root; seeded with `'Demo Team'` in-migration |
| `users` | 0001 | `email CITEXT UNIQUE`, role CHECK |
| `refresh_tokens` | 0001 | one row per issued token; `expires_at` + `revoked_at` |
| `incidents` | 0002 | severity + status CHECKs |
| `timeline_entries` | 0002 | `body JSONB`, nullable `author_id` |
| `diagnoses` | 0003 | AI output storage — **table exists, no code reads or writes it** |
| `resolutions` | 0003 | **table exists, no code reads or writes it** |
| `machine_fingerprints` | 0004 | `UNIQUE (user_id, project_id)` — upsert conflict target |
| `signatures_detected` | 0004 | **table exists, no code reads or writes it** (needs the agent) |
| `schema_migrations` | runtime | created by `migrate.ts`, filename PK |

**Indexes: none declared.** No `CREATE INDEX` statement exists in any
migration. The only indexes present are those Postgres creates implicitly for
PRIMARY KEY and UNIQUE constraints.

## 1.5 CLI

No standalone CLI binary. npm scripts only:

```
dev      nodemon --exec tsx src/index.ts
build    tsc
start    node dist/index.js
migrate  tsx src/db/migrate.ts
test     vitest run
```

`npm run migrate` is the only real CLI program — `migrate.ts` has a
`import.meta.url === pathToFileURL(process.argv[1]).href` run-as-script guard.

## 1.6 Test suites — 42 tests

| Suite | Tests | Type |
|---|---|---|
| `fingerprints.smoke` | 11 | HTTP + real Postgres |
| `fingerprints.queries` | 9 | direct `pool.query` |
| `timeline.smoke` | 5 | HTTP + socket |
| `auth.smoke` | 4 | HTTP |
| `incidents.smoke` | 4 | HTTP |
| `schema` | 4 | constraint assertions |
| `socket-auth` | 3 | handshake |
| `socket` | 2 | room join + persist |

---

# 2. Architecture & Design Patterns

## 2.1 Stack

**Server:** Node ESM (`"type": "module"`, NodeNext resolution) · Express 4.19 ·
PostgreSQL via `pg` 8.12 · Socket.io 4.8 · Zod 4.4 · jsonwebtoken 9 · bcrypt 6

**Testing:** Vitest 4 · supertest 7 · socket.io-client 4.8

**Client:** React 19 · Vite · TypeScript — **fully mocked, zero API calls**

## 2.2 Three-layer server pattern

Applied uniformly across all four domains (auth, incidents, timeline,
fingerprints):

```
routes/index.ts    Router construction + Zod schema + middleware chain
routes/<verb>.ts   one handler per endpoint; HTTP concerns only
queries.ts         all SQL; returns plain rows; no req/res
types.ts           row shapes mirroring SQL columns
```

## 2.3 Middleware chain

Order is invariant: `requireAuth` → `validateBody(schema)` → handler.

`requireAuth` runs first because it populates `req.user`, which every
protected handler dereferences with `!`.

`validateBody` reassigns `req.body = result.data`. This is load-bearing, not
cosmetic — it strips unknown keys and materializes Zod defaults. It is the
only reason `.nullable().default(null)` on the fingerprint schema has any
effect.

## 2.4 Connection pooling

One module-level `pg.Pool` in `db/pool.ts`. ESM module caching makes it a
true singleton.

Two deliberate configurations:

- **`types.setTypeParser(types.builtins.INT8, ...)`** — coerces `BIGINT` to JS
  `number` process-wide. Without it `pg` returns int8 as a string and every
  `number`-typed id in the codebase is a runtime lie.
- **`NODE_ENV === 'test'` switches to `TEST_DATABASE_URL`** — load-bearing
  safety switch, because `tests/setup.ts` runs `TRUNCATE ... CASCADE` against
  this exact pool after every test.

## 2.5 Socket architecture

**Handshake gate.** `io.use(socketAuth)` runs once per connection before any
handler, reading the token from `socket.handshake.auth.token` and stamping
`socket.data.{userId, orgId, role}`. By the time any handler runs,
`socket.data` is trustworthy.

**Per-packet validation.** `validateSocketData` looks up a Zod schema by event
name in:

```ts
Record<keyof ClientToServer, z.ZodType>
```

A mapped type over the inbound event union, so omitting a validator for a new
event is a **compile error**, not a runtime gap. An unknown event name is
rejected explicitly rather than passing through undefined.

**Error sink.** `socketErrorSink` catches middleware rejections, emits
`Invalid-Schema`, then calls `socket.disconnect(true)`.

**Room naming** is centralized in `formatRoomName(id) => "Incident-${id}"` so
join and emit cannot drift apart.

## 2.6 Tenant isolation

**Standard pattern — org gate, not row filter.** Handlers call
`findIncidentById(id, orgId)` first. A null result returns **404, never 403**,
so a caller cannot distinguish "not yours" from "doesn't exist" and cannot
probe which ids exist. Downstream timeline queries carry no org filter of
their own and rely entirely on that gate having run.

**Exception — fingerprints.** `machine_fingerprints` has no `org_id` column, so
isolation reaches one table over:

```sql
SELECT f.*, u.email AS published_by
FROM machine_fingerprints f
JOIN users u ON u.id = f.user_id
WHERE f.project_id = $1 AND u.org_id = $2
```

`SELECT f.*` and not `SELECT *` — a bare star across this join would put
`users.password_hash` in an API response. This is the one place where copying
the house `SELECT *` pattern is a security bug.

## 2.7 Migration runner

Forward-only, no down-migrations, no framework. Filename-sorted, flat
directory. **One transaction per file**, so a failure on a late file cannot
roll back files that already applied. The ledger `INSERT` rides inside the
same transaction as the DDL, closing the "applied but unrecorded" gap.

---

# 3. ADR Trade-Off Rationale

15 ADRs exist. **6 are merged to `main`; 9 are on unmerged branches.**
Numbering has deliberate gaps because branches were developed in parallel — a
gap is harmless, a duplicate is not.

## 3.1 Merged to `main`

### ADR 0001 — PostgreSQL as single source of truth

**Failure mode.** With Socket.io delivering live updates, treating the stream
as truth means arrival order is non-deterministic and a disconnected client
has no authority to recover from. Broadcast-then-store variants can display
data that was never persisted.

**Rejected.** Peer-to-peer agent sync — distributed consistency problems with
no arbiter, zero benefit at MVP scale. Socket-stream-as-truth — network
arrival order is not trustworthy.

**Constraint.** Multiple agents plus multiple browsers must converge on one
reality.

**Enforced as three standing invariants:** DB write before broadcast; sort by
`(incident_id, id)`; reconnect refetches the gap via `?since=`.

### ADR 0002 — Raw `pg` over an ORM

**Bottleneck.** Not performance — comprehension. The author must defend every
query from memory in a technical interview.

**Rejected.** Knex — builder semantics become a second thing to know cold on
top of SQL. Prisma — hides the literal query, adds a codegen step, heaviest
abstraction of the three.

**Constraint.** Defensibility beat development speed.

**Cost accepted.** Manual param binding, hand-written row types, no
down-migrations, no migration CLI.

### ADR 0003 — Schema conventions

Eight interlocking decisions. The three with real teeth:

**Referential actions follow ownership, not a uniform rule.** Parts-of-a-parent
CASCADE (timeline entries, diagnoses, resolutions → incidents; fingerprints →
users). Standalone history SET NULL (`signatures_detected`, author columns).
Tenant links RESTRICT (users/incidents → orgs).
*Why not uniform:* CASCADE everywhere would erase `signatures_detected`, the
archive that past-incident mining depends on. RESTRICT everywhere would make
incidents effectively undeletable for no benefit.

**TEXT + named CHECK over Postgres ENUM.** Widening an ENUM requires
`ALTER TYPE`; a CHECK widens with a plain migration.

**`citext` over `lower()` index or app-side normalization.** A functional index
makes every query remember `lower()`; app-side normalization trusts every write
path. `citext` moves the guarantee into the type system. Cost: a Postgres
extension dependency.

### ADR 0004 — bcrypt at cost 12

**Failure mode.** A stolen `password_hash` column brute-forced offline.

**The reasoning that got corrected.** Initial lean was scrypt for "no new
dependency, Node already has it." That was invalidated on inspection: Socket.io
already forces a persistent long-running server, ruling out the serverless and
edge targets where native compiled addons are a genuine problem. The
dependency-avoidance motivation did not apply.

**Rejected.** scrypt — the built-in gives only the raw primitive; salt
generation, salt+hash encoding, and `crypto.timingSafeEqual` all become code
this project owns and must keep correct. argon2 — OWASP's current top pick and
memory-hard, but `memoryCost` is a real per-request memory reservation that
could cause pressure under a concurrent-login burst on a small server.

**Constraint, quantified.** Each `+1` to the cost factor doubles work
(`2^rounds` key-schedule iterations), so 12 is 4× the compute of OWASP's floor
of 10. That lands around **~250ms per hash** — expensive enough that an
attacker pays 250ms per guess, fast enough that login does not feel slow.

**Known and accepted.** bcrypt silently truncates passwords past 72 bytes.

### ADR 0005 — Access token payload `{ sub, org_id, role }`

**Bottleneck.** `requireAuth` makes no database call — it only calls
`verifyAccessToken`. Anything absent from the payload costs a query on every
request that needs it.

**Per-field reasoning, which is the actual decision.**
`org_id` — `users.org_id` is `NOT NULL` with no org-reassignment path anywhere
in the schema, so it cannot go stale for a user's lifetime. Embedding is free.
`role` — can change via promotion or demotion, so embedding trades a staleness
window **bounded by the 15-minute `ACCESS_TOKEN_TTL`** against a DB round trip
on every authenticated read-heavy request.

**Rejected.** DB lookup per request — adds a round trip for freshness `org_id`
never needs and `role` needs only on the rare tick after a role change.

**Revisit trigger, named in advance.** If an admin must force-demote a user
mid-incident, either shorten the TTL or move `role` alone back to per-request
lookup while keeping `org_id` embedded.

### ADR 0010 — Fingerprint endpoints

**Failure mode driving the central choice.** This row is what Tier 2 signatures
diff *against*. A field silently retaining a previous value would make the row
a blend of several points in time, producing a wrong diff that nothing
surfaces. **A null is visibly missing; a stale value is invisibly false.**

**Decision.** Full-replace PUT via
`INSERT ... ON CONFLICT ON CONSTRAINT ... DO UPDATE`, every column taking the
`EXCLUDED` value. The repo's first `ON CONFLICT`.

**Rejected.** SELECT-then-branch — two round trips with a race where concurrent
publishes both see "no row" and one hits the unique violation. `COALESCE` merge
semantics — the genuine middle path (absent means don't touch, explicit null
means wipe) needs a dynamically built SET clause, which this codebase's static
`$1..$n` style does not do. 201-on-create — requires reading the `xmax` system
column to learn which branch the upsert took, putting MVCC internals in an
application query for a distinction nothing consumes.

**Constraint.** The `UNIQUE (user_id, project_id)` constraint that migration
0004 declared is the conflict target it was created for.

**Secondary decision.** `GET` returns `published_by` (the publisher's email)
because the endpoint exists so two machines can be compared, and
`user_id: 7` tells a human nothing. The join is already open for the org
filter, so the column is free.

## 3.2 Unmerged — decisions recorded, code not on `main`

### ADR 0006 — LangChain structured output + explicit validation *(PR #21)*

**Failure mode.** An LLM is nondeterministic and free-form; the contract
promises a valid `AiDraft` or a clean failure.

**Decision.** Compose two mechanisms rather than pick one:
`withStructuredOutput` bound to `aiDraftSchema` shapes the model at the
provider level, **and** an explicit `aiDraftSchema` parse at the function's
exit is the owned trust boundary.

**Why composed.** Structured output guarantees *shape*, not *content* — `""` is
a valid string. Relying on the library's internal check alone outsources the
trust boundary and would silently vanish the day structured output is swapped.
Hence `.min(1)` on all three fields.

**Rejected.** Prompt-and-parse — the model can wrap JSON in prose or fences;
kept as a fallback, which is why `buildPrompt` stays separable. Structured
output alone. Explicit parse alone. Provider SDK without LangChain — loses
provider-swap flexibility. Agentic clarify loop — breaks the frozen contract
the delivery half builds against.

### ADR 0007 — Ship Minimum, measure, add complexity on trigger *(PR #21)*

**Bottleneck.** The characteristic failure of an AI feature is speculative
complexity — building an agent or cache for load that does not exist.

**Decision.** One-shot `draftFromContext`, no retry, no cache, no agent. Each
deferral carries an **explicit revisit trigger** so "later" is a condition, not
a vibe: retry when the observed invalid-output rate justifies it; caching when
identical context is re-drafted often; clarify loop only if reviewers find
one-shot drafts lack context; model tier change if drafts need heavy editing.

**Named as required measurements:** invalid-output rate, **reviewer edit
effort**, cost. (ADR 0014 later depends on this.)

### ADR 0008 — Additive-optional context expansion *(PR #21)*

**Constraint.** `AiDraftRequest` is the seam the delivery half builds against.

**Decision.** Expansion happens only by adding **optional** fields; existing
fields never change type or become required. Two tiers: near-term incident
metadata (`title`, `severity`, `affected_system` — already fetched by the org
gate, so near-free), and a deferred project-direction document.

**Rejected.** Expanding everything up front — retrieval/RAG especially is heavy
infrastructure with no evidence it earns its cost. Making added context
required — breaks the contract. Keeping it permanently minimal.

### ADR 0009 — Provider switch to Google Gemini free tier *(PR #21)*

**Constraint that forced it.** Anthropic's API has no free tier at any model
level — billed per token from the first request. Gemini offers a standing
rate-limited free tier on Flash-class models through the same LangChain
surface.

**Scope.** Provider and model only. Everything 0006 decided carries over
unchanged. Supersedes 0006's model choice, not its architecture.

**Rejected.** Absorb Anthropic's cost. Local models via Ollama — genuinely $0
but requires the developer's machine to run inference. Rewriting around
Gemini's native SDK — would cost the exact flexibility LangChain was chosen
for.

### ADR 0011 — Relevance signals: display vs scoring *(PR #20)*

**Constraint.** `architecture.md` line 187: *"Reason matters more than score —
the UI shows the reason."* A bare number leaves the reason generator nothing to
write but the number.

**Decisions.** Three named signals (recency, frequency, ownership) rather than
one opaque score. **Ownership weighted above recency** — in an incident the
useful answer is who knows the code, not who edited it last; pure recency
decay would rank a typo fix above the module's author. Some fields are
**display-only and never enter the maths**. Merge commits filtered at the
collector. Author date, not commit date, because rebasing rewrites commit
dates. Exponential decay on a 14-day half-life rather than a cutoff.

**Rejected.** Single opaque score. Pure recency decay. Scoring on
commit-message keywords — intent inferred from prose, rewards people who write
certain messages, fails silently.

### ADR 0012 — Collector reads full history, no cutoff *(PR #20)*

**Failure mode.** The choice lives in the collector; the damage lands in the
scorer. A `--since` flag is one argument in one person's code; the signal it
degrades is in a different file owned by a different person.

**Decision.** No date cutoff. The half-life already decides how much recent
work matters — at 14 days, a six-month-old commit weighs 0.0001 and is already
invisible to recency. A cutoff removes only data that ownership was still
reading, and ownership is the highest-weighted signal.

**The product argument.** When a module nobody has touched in six months
breaks, a 90-day window makes every score zero and the app has nothing to say.
That is exactly the case where relevance is most valuable.

### ADR 0013 — The arithmetic of relevance scoring *(PR #20)*

**Why it exists.** Every way of collapsing a list of commits into one number
produces a plausible value between 0 and 1, so a wrong choice looks identical
to a right one in the output.

**Recency is the maximum decay weight**, not the sum or mean. Summing breaks
the 0..1 ceiling on the second commit and, because it grows with commit
*count*, silently becomes a frequency measure. Averaging punishes people for
having more history.

**Frequency is `min(count / cap, 1)` over a 30-day window.** Without the clamp,
40 commits returns 4 and one signal outweighs the other two regardless of
weights. Windowed-and-absolute against ownership's all-time-and-relative is
what keeps the two able to disagree.

**Ownership's denominator counts departed authors**, so shares can total less
than 1 — that gap honestly says nobody still here owns this file.

### ADR 0014 — Confirming an AI draft sets its author *(PR #22)*

**Failure mode.** Migration 0002 says `'system'` and `'ai_draft'` entries have
no human author. Nothing enforced it — the POST schema accepted both types and
the handler stamped the token's `sub` unconditionally.

**Decision.** Confirming sets `author_id`. **No new columns.** `author_id IS
NULL` means unconfirmed; set means a human vouched. A `confirmed_by` column
would hold the same value as `author_id`.

**Why no editing before confirming — the strongest argument here.** ADR 0007
named reviewer edit effort as a required measurement and made "drafts
consistently need heavy editing" the trigger for changing model tier. In-place
editing makes a confirmed row sometimes the model's text and sometimes a
human's with nothing distinguishing them, so that trigger can never fire.
Under confirm-or-reject, the ratio itself is the metric.

**Consequence recorded rather than discovered.** `author_id` is
`ON DELETE SET NULL`, so deleting a user silently un-confirms every draft they
approved.

### ADR 0015 — Testing strategy: examples verified by mutation *(PR #20)*

**Decision.** Two tiers, and the line between them is I/O. Real Postgres, never
mocked — the bugs worth catching are in the SQL (a wrong `ON CONFLICT` target,
a `SELECT *` across a join), and a mock cannot reach any of them.

**Mutation as the bar, not coverage.** A test that passes proves nothing; a
test that fails when the thing it describes breaks has been verified. Coverage
measures which lines ran — every mutation killed so far was in a line coverage
already counted.

**Purity as a design-time decision.** `now` as a parameter is what lets a test
assert exactly 0.5 rather than approximately a half; a tolerance is where a
real drift hides.

**Honest about enforcement.** No CI exists, so a red suite can merge and
mutation testing leaves no artifact but a commit message.

---

# 4. Operational Metrics & Constraints

## 4.1 State synchronization rules

| Rule | Enforced in |
|---|---|
| DB write before socket broadcast | `timeline/routes/create.ts`, `emittingMessages.ts` |
| Order by `(incident_id, id)`, never arrival time | `ORDER BY id ASC` in timeline queries |
| Sockets never replay history | reconnect uses `GET /incidents/:id/timeline?since=` |
| `>` not `>=` in gap-fill | `WHERE id > $2` — skips the entry the client holds |
| One fingerprint per `(user_id, project_id)` | UNIQUE constraint as upsert conflict target |
| `updated_at` assigned in `DO UPDATE` | column DEFAULT fires on INSERT only, never UPDATE |
| Identity from token, never body | every handler reads `req.user!`, ignores body identity |

## 4.2 Timing and limits

| Constraint | Value | Source |
|---|---|---|
| Access token TTL | **15 minutes** | `constants/auth.ts` |
| Max role staleness | **15 minutes** (= TTL) | ADR 0005 |
| Refresh token TTL | **30 days** | `REFRESH_TOKEN_TTL_MS`, matched to cookie `maxAge` |
| bcrypt cost factor | **12** (~250ms/hash) | ADR 0004 |
| Socket ack timeout | none on `main` | — |
| Pool max connections | **pg default (10)** | untuned |
| Postgres connection ceiling | 100 (default) | — |
| Rate limiting | **none** | — |
| Request timeouts | **none** | — |

`REFRESH_TOKEN_TTL_MS` is centralized specifically because three copies of it
once drifted, letting a cookie and its database row expire at different times.

Tests run **serially** (`fileParallelism: false`) because suites share one pool
and `TRUNCATE` between tests.

## 4.3 Payload definitions

**Access token**
```ts
{ sub: string, org_id: number, role: 'responder' | 'lead' | 'admin' }
```

**Refresh cookie** — `httpOnly: true`, `sameSite: 'strict'`,
`secure: NODE_ENV === 'production'`, `maxAge: 30 days`

**Refresh token storage** — SHA-256 hex digest via `createHash('sha256')`.
The raw 32-byte base64url token is never stored.

**Socket `sending-message`** — strictly narrower than the REST equivalent.
Requires `body: { summary, why_it_matters, likely_fix }`, while
`postTimelineEntrySchema` accepts any `z.record(z.string(), z.unknown())`.

**`applied_migrations`** — JSONB string array. `null` is passed unstringified,
because `JSON.stringify(null)` produces JSON `null`, which `IS NULL` does not
match.

## 4.4 Error handling

| Mechanism | Behavior |
|---|---|
| Missing vs other-org incident | Identical **404** with generic message — prevents id enumeration |
| Unknown email vs wrong password | Identical **401**; user lookup checked first so no comparison runs against nothing |
| Auth failure codes | `token_missing`, `token_expired`, `token_invalid` — `token_expired` signals the client to hit `/refresh` rather than re-login |
| Zod body rejection | **400** with `result.error` |
| Socket schema rejection | Emit `Invalid-Schema`, then `socket.disconnect(true)` |
| Unknown socket event | Rejected explicitly — an unmapped name does not pass through |
| Startup | `pool.connect()` before `listen()` — a dead pool crashes at boot instead of passing `/health` |
| Migration failure | ROLLBACK the failing file, rethrow, halt — never apply a later migration onto a half-broken schema |

## 4.5 Defects present on `main`

1. **`emittingMessages.ts` throws on a nonexistent incident.**
   `const { rows: [incidents] } = ...` destructures `undefined` from an empty
   result, then `incidents.org_id` raises a `TypeError`. It is caught by the
   generic handler and reported as a persist failure, so the client receives a
   misleading error. *Fixed in PR #19.*

2. **Duplicate broadcast events.** REST emits `entry:new`, socket emits
   `new-message`, for the same fact. *Resolved in PR #19.*

3. **`ai_draft` and `system` accepted from clients** while `create.ts` stamps
   `author_id` from the token unconditionally, producing rows that contradict
   migration 0002's own comment. *Fixed in PR #23.*

4. **No indexes** on `timeline_entries.incident_id` or `incidents.org_id`,
   despite both being the primary filter column on every read of those tables.

5. **Three tables are dead.** `diagnoses`, `resolutions`, and
   `signatures_detected` exist with full constraints and no code path reads or
   writes any of them. `signatures_detected` requires the unbuilt agent.

6. **Client is entirely mocked.** `client/src/data/rooms.ts` is a hardcoded
   array; there is not a single `fetch`, `axios`, or API base URL anywhere in
   `client/src`.

7. **No CI.** `.github/` contains only `pull_request_template.md`. Nothing
   enforces that the suite passes before merge.
