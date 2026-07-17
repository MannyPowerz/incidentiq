/**
 * pool.ts — the process's single shared Postgres connection pool.
 *
 * Approach: one module-level Pool, reused by every importer. An ES module's body
 * runs once and is cached, so `pool` is effectively a singleton — that is what
 * makes "shared" real.
 *   ↳ vs. a new pg Client per query — rejected: a TCP + auth handshake on every
 *     call, plus manual connect()/end(); zero reuse.
 *   ↳ vs. a Pool per request — rejected: each Pool opens its own connections, so
 *     N in-flight requests = N pools and you exhaust Postgres' max_connections
 *     (default 100). Pooling only pays off when the pool is shared.
 * Look up (pg docs): Pool `max` / `idleTimeoutMillis` (we take the defaults —
 *   fine for a small team, revisit under load), and that pool.connect() hands you
 *   a client you MUST release() or the pool starves (pool.query() does it for you).
 *
 * Consumed by: src/index.ts (startup fail-fast connect), tests/setup.ts (per-test
 *   TRUNCATE + teardown) and the CLI block of src/db/migrate.ts. Note: tests/
 *   globalSetup.ts deliberately builds its OWN pool from TEST_DATABASE_URL, not this one.
 */
import 'dotenv/config';
import { Pool } from 'pg';

// Load-bearing safety switch: under NODE_ENV=test this MUST resolve to the throwaway
// TEST_DATABASE_URL, because tests/setup.ts runs `TRUNCATE ... CASCADE` against this
// exact pool after every test. Leave it pointed at DATABASE_URL during tests and the
// suite wipes your dev data.
const connectionString =
  process.env.NODE_ENV === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

export const pool = new Pool({ connectionString });
