# 0002 - Raw pg over an ORM/query builder

## Context
CLAUDE.md left the DB access layer UNDECIDED between raw pg, Knex, and
Prisma. Person 1 owns all schema and query code and is building this project
partly to defend every decision from memory in a technical interview — the
tool choice needs to optimize for comprehension of what's actually happening
in Postgres, not just development speed.

## Decision
Use the existing `pg.Pool` directly with hand-written SQL. Migrations are
plain numbered `.sql` files in `server/db/migrations/`, applied by a small
hand-rolled runner (no migration framework).

## Alternatives rejected & why
- **Knex** — query builder API sits between the developer and the SQL;
  removes boilerplate but adds a second thing to know cold (its builder
  semantics) on top of SQL itself.
- **Prisma** — generated client + schema file give strong type safety and
  fast prototyping, but hide the literal query that runs, add a codegen
  build step, and are the heaviest abstraction of the three — worst fit for
  being able to explain exactly what hits the database.

## Consequences
- Every query is hand-written and fully visible in the route/query files —
  good for defensibility, costs more boilerplate and manual param binding.
- No generated TypeScript types from the schema; row shapes are typed by
  hand where needed.
- No down-migrations or migration CLI — the hand-rolled runner only applies
  forward, in order, tracked in a `schema_migrations` table.
