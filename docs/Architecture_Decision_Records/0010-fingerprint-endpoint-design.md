# 0010 - Fingerprint endpoints: upsert semantics, org-scoped reads, and payload shape

> Numbered 0010, not 0006, on purpose: 0006 through 0009 exist on the
> `feat/ai-brain` branch and are not yet merged. A gap on this branch is
> harmless; two ADRs sharing a number is not.

## Context
`machine_fingerprints` has existed since migration 0004 but nothing reads or
writes it. The table was designed with the endpoints in mind — the migration
comments name `PUT /api/fingerprints` as an upsert and pin
`UNIQUE (user_id, project_id)` as its conflict target, and ADR 0003 records
the same. What none of that settled is the HTTP contract: request and response
shapes, status codes, what `?project=` returns, and how a republish treats
fields the body left out.

`docs/contracts.md` was empty when this work started, so there was nothing to
look up. These decisions were made rather than found, which is the reason for
recording them here.

One schema fact drove several of the choices: **the table has no `org_id`
column.** Every other query module in the server enforces the tenant boundary
with `WHERE org_id = $1` directly on the table it reads. This one cannot.

## Decision

**Mounted at `/fingerprints`, no `/api` prefix.** The existing three mounts
(`/auth`, `/incidents`, `/incidents/:id/timeline`) have no prefix, and this
server returns JSON only — no views, no static assets — so `/api` would
namespace against nothing. The `/api/fingerprints` in ADR 0003 and migration
0004 predates those routes.

**`PUT` is an upsert via `INSERT ... ON CONFLICT (user_id, project_id) DO
UPDATE`** — the first `ON CONFLICT` in this codebase. One atomic round trip,
and the conflict target is the constraint the schema already declared for it.

**`PUT` is a full replace, not a merge.** An omitted optional field is stored
as `null`, overwriting whatever was there. This row is what Tier 2 signatures
diff *against*, so a field that quietly kept its previous value would make the
row a blend of several points in time and produce a wrong diff that nothing
surfaces. A `null` is visibly missing; a stale value is invisibly false. The
publisher is an automated agent reading a machine, so it always has every
field — partial publishing is a hypothetical, and it arrives as a separate
`PATCH` if it ever stops being one.

**`PUT` always returns 200**, whether the row was created or updated. `PUT`
states an intent and the caller has no use for which branch the upsert took.

**`GET /fingerprints?project=X` returns every fingerprint for that project
across the caller's org**, as an array ordered by `user_id`, with an empty
array for "nobody published" rather than a 404. Reading only your own row
would make the two-machine comparison in build-plan.md impossible. The tenant
boundary is enforced by joining `users` and filtering that user's `org_id`.

**`GET` rows carry `published_by`** (the publisher's email, aliased from
`users.email`), so the response type is `FingerprintWithPublisher`, not
`MachineFingerprint`. The comparison this endpoint exists to enable is read by
a person, and `user_id: 7` does not tell anyone whose environment differs. The
join is already open for the org filter, so the column is free; resolving ids
client-side afterwards would cost a round trip per row. `PUT` returns the bare
row — its caller published it and already knows.

**`applied_migrations` stores migration filenames as a JSONB string array**,
matching `schema_migrations`' `filename` primary key. Drift detection is a set
difference over those names.

**`updated_at` is set explicitly in the `DO UPDATE` set-list.** ADR 0003
already records that skipping the trigger was deliberate and makes this app
code's job; this is the code that owes it.

## Alternatives rejected & why
- **`SELECT` then branch to `INSERT` or `UPDATE`** — rejected: two round trips
  with a race between them, where concurrent republishes both see "no row" and
  one hits a unique violation. `ON CONFLICT` is atomic and the constraint was
  put there for it.
- **`COALESCE(EXCLUDED.col, machine_fingerprints.col)` merge semantics** —
  rejected as the default for the diff-correctness reason above. The genuine
  middle path, treating an absent field as "don't touch" and an explicit
  `null` as "wipe", is expressible in zod but not in one static SQL statement:
  it needs either a dynamically built `SET` clause (this codebase uses only
  static `$1..$n`) or a per-column boolean driving a `CASE`. Too much
  machinery for a need no current publisher has.
- **201 on create, 200 on update** — rejected: requires the upsert to report
  which branch it took, which in Postgres means reading the `xmax` system
  column. That is MVCC internals appearing in an application query, and
  nothing downstream consumes the distinction — there is no first-publish hook
  and no socket broadcast on fingerprints.
- **204 No Content on `PUT`** — rejected: `id` and `updated_at` are both
  server-generated, and every other route in this app returns its row under a
  named key. A 204 would make this the one endpoint you cannot read back from.
- **`GET` returning only the caller's own fingerprint** — rejected: simpler and
  consistent with how other modules scope, but build-plan.md line 50 calls
  "Node version diff between two machines" the demo closer, and that diff
  cannot be built on an endpoint that only ever returns one row.
- **`applied_migrations` as objects carrying `applied_at`** — rejected:
  `applied_at` is per-machine wall-clock, so two machines with identical
  migrations would differ on every element and the comparison would have to
  strip it back out. Storing noise the only consumer must discard.
- **Returning bare fingerprint rows from `GET`** — rejected once the endpoint's
  purpose was traced through: it exists so two machines can be compared, and a
  comparison without publisher identity is only half usable. Widening a
  response later is backward-compatible, so this could have been deferred; it
  was not, because the join that makes it free is already there.
- **A parent `apiRouter` mounted at `/`** — considered and deferred, not
  rejected. It would group the HTTP surface apart from the socket surface and
  give one insertion point for API-wide middleware or a version prefix,
  without changing any URL. Nothing needs that insertion point today. Revisit
  the first time something must apply to every HTTP route but not to sockets;
  because URLs do not change, it stays a pure internal refactor whenever it
  happens.

## Consequences
- This is the first `ON CONFLICT` in the repo. There is no local precedent to
  copy, and the `DO UPDATE` set-list is the single place this feature can be
  quietly wrong — hence a constraint-level test written directly against
  `pool.query` before any route exists.
- The tenant boundary for this feature lives one table over, in a JOIN, rather
  than in a `WHERE` on the table being read. It reads like a missing filter to
  anyone who knows the other query modules, so the query carries a comment
  saying why.
- Because the read joins `users`, the `GET` query must select `f.*` and not
  `*`. A bare `*` across a join returns both tables' columns, which would put
  `users.password_hash` in an API response. Every other query module in this
  server uses `SELECT *` safely, so this is the one place where copying the
  house pattern is a security bug rather than a style choice.
- `applied_migrations` as `string[]` means that if per-migration metadata is
  ever needed, it is a data backfill of existing JSONB rows and not just a
  type widening. Accepted knowingly: the stricter type is more useful to the
  one consumer that exists, and the migration cost is paid only if the need
  materializes.
- `validateBody` covers request bodies only; no query-param middleware exists.
  The 400 on a missing `?project=` is a hand-written check in the handler,
  going further than `timeline/routes/get.ts`, which reads `req.query.since`
  with no validation at all.
- Full-replace semantics put a real obligation on every client: send the whole
  snapshot or lose fields. `docs/contracts.md` states this explicitly because
  the failure mode is silent data loss rather than an error.
