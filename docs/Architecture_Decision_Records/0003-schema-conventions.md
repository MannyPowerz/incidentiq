# 0003 - Schema conventions for the 8-table Minimum schema

## Context
ADR 0002 committed to raw pg with hand-written `.sql` migrations but left the
schema's shape and conventions open. Building the full Minimum schema (orgs,
users, incidents, timeline_entries, diagnoses, resolutions,
machine_fingerprints, signatures_detected) forced a batch of interlocking
decisions a teammate could reasonably question. This ADR records them in one
place; the migration files carry the same reasoning as inline comments.

## Decision
1. **Migrations batched by dependency cluster, not one-per-table.** Four
   files: tenancy (orgs, users), incident core (incidents, timeline_entries),
   outcomes (diagnoses, resolutions), scanner (machine_fingerprints,
   signatures_detected). In-file order is dependency order; the filename
   number prefix is the only cross-file ordering mechanism (the runner sorts
   by filename, flat directory only — no subfolders).
2. **The demo org is seeded in-migration.** `INSERT ... 'Demo Team'` lives in
   0001 beside the CREATE, so schema and tenant commit atomically in the same
   transaction. Tests depend on it: `tests/setup.ts` truncates every other
   table but never orgs.
3. **`citext` for email uniqueness.** The extension is enabled in 0001 and
   `users.email` is `CITEXT NOT NULL UNIQUE`, making `Alice@x.com` and
   `alice@x.com` the same login at the type level.
4. **JSONB for all structured content** (`timeline_entries.body`,
   `machine_fingerprints.applied_migrations`, `signatures_detected.payload`).
5. **Referential actions follow ownership.** Parts-of-a-parent CASCADE
   (timeline entries, diagnoses, resolutions → incidents; fingerprints →
   users). Standalone history SET NULLs (signatures_detected → incidents /
   fingerprints; author columns everywhere). Tenant links RESTRICT
   (users/incidents → orgs).
6. **Fixed vocabularies are TEXT + named CHECK constraints**, not Postgres
   ENUMs (severity, status, role, entry type, tier).
7. **`project_id` is a bare TEXT column, no FK.** A projects table was
   weighed and dropped as scope creep beyond the planned 8 tables.
8. **One fingerprint per (user, project)**, enforced by a UNIQUE constraint —
   the upsert conflict target for `PUT /api/fingerprints`.

## Alternatives rejected & why
- **One migration file per table** — eight files whose split conveys nothing
  (all are "the beginning") while spreading FK-ordering burden across
  filenames. **One giant init file** — loses the per-cluster resume point the
  runner's per-file transactions provide.
- **Seeding in test setup or a separate seed file** — leaves environments
  where migrations ran but the seed didn't; rejected while there is no
  production environment to pollute.
- **`lower(email)` functional index or app-side normalization** — both work,
  but the functional index makes every query remember `lower()`, and
  app-side normalization trusts every write path; citext moves the guarantee
  into the type. Cost: a Postgres extension dependency (bundled contrib).
- **JSON over JSONB** — preserves byte-exact input, but loses indexing and
  query-inside-the-field; nothing in this system cares about whitespace
  fidelity, and schema tests already cast `::jsonb`.
- **Postgres ENUMs** — widening one requires `ALTER TYPE`; a CHECK widens
  with a plain migration.
- **CASCADE everywhere or RESTRICT everywhere** — uniform rules read simpler
  but lie about ownership: cascading signatures_detected would erase the
  archive that "similar past incident" mining reads; restricting timeline
  entries would make incidents effectively undeletable for no benefit.

## Consequences
- The schema_migrations ledger pins these filenames forever once applied to
  any shared database; renaming applied migrations is off the table.
- `CREATE EXTENSION citext` requires contrib to be available (standard on
  stock installs and the common Docker images); a stripped-down Postgres
  will fail migration 0001 loudly.
- App-side lists (Zod schemas, TypeScript unions) must stay in sync with the
  CHECK vocabularies by hand — there is no codegen (per ADR 0002).
- Deleting an incident silently deletes its timeline, diagnoses, and
  resolutions but leaves its detections behind with `incident_id = NULL`;
  anyone adding delete endpoints later must know both behaviors are
  intentional.
- The 30-minute entry-immutability rule and the fingerprint `updated_at`
  refresh are app-layer obligations the schema deliberately does not enforce.
