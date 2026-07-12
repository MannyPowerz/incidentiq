/**
 * migrate.ts — idempotent SQL migration runner.
 *
 * Applies db/migrations/*.sql in filename order, each in its own transaction, and
 * records every applied file in a schema_migrations ledger so re-runs are no-ops.
 * Raw pg + hand-rolled .sql, no migration library (see ADR 0002) — this is the
 * least code that still gives once-only apply + atomic-per-file rollback.
 *
 * Callers pass in a pool and own its lifecycle (this never ends a pool it was
 * handed). Verified consumers: the CLI block at the bottom of this file, and
 * tests/globalSetup.ts (which builds its own throwaway pool). index.ts does NOT
 * call this. Reads .sql from ../../db/migrations.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import type { Pool } from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

export async function runMigrations(pool: Pool): Promise<void> {
  // One dedicated client held for the whole run (released in the finally). Required,
  // not incidental: the BEGIN/COMMIT/ROLLBACK below are per-connection, so every
  // query must ride the SAME client. pool.query() could pick a different pooled
  // connection each call and silently scatter the transaction across connections.
  const client = await pool.connect();
  
  try {
    // Idempotency ledger, created on first run (IF NOT EXISTS). A row here —
    // filename as PRIMARY KEY — means "this file has been applied"; re-runs skip it.
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    );

    const { rows } = await client.query<{ 
        filename: string }>
        ('SELECT filename FROM schema_migrations');

    const done = new Set(rows.map((r) => r.filename));

    const files = (await readdir(migrationsDir)).filter( (f) => f.endsWith('.sql') ).sort();

    const pending = files.filter((f) => !done.has(f)); // set difference: disk minus ledger

    if (pending.length === 0) {
      console.log('Database up to date — no pending migrations');
    }
    
    console.log(`Pending: ${pending.length} migration(s)`);

    // Each migration runs in its OWN transaction, not one wrapping all pending
    // files, so a failure on a late file can't roll back migrations that already
    // applied cleanly — a re-run just resumes at the failed one. On error we
    // ROLLBACK this file and rethrow to halt the run (fail-fast): never apply a
    // later migration onto a half-broken schema.
    for (const file of pending) {
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      
      try {
        console.log(`Applying ${file}...`);
        await client.query(sql);
        
        // Ledger INSERT rides INSIDE the same transaction as the migration SQL, so
        // the schema change and the record of it commit atomically — no "applied but
        // unrecorded" (would double-apply next run) or "recorded but not applied" gap.
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);

        await client.query('COMMIT');
        console.log(`✓ Applied ${file}`);

      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`✗ Failed on ${file} — rolled back`);
        throw err;
      }
    }

  } finally {
    client.release();
  }
}

// Run-as-script guard: true only when this file is launched directly (the CLI path),
// false when another module imports runMigrations — the ESM equivalent of CommonJS
// `require.main === module`. The verified importer, tests/globalSetup.ts, skips this
// block and calls runMigrations with its own pool.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Import the shared pool lazily and only on the CLI path, so that importing
  // runMigrations from elsewhere doesn't spin up a DB connection as a side effect.
  const { pool } = await import('./pool.js');
  
  try {
    await runMigrations(pool);
  } catch (err) {
    console.error('Migration failed:', err);
    // exitCode, not process.exit(1): let the finally below run pool.end() and the
    // event loop drain before exiting non-zero. process.exit() would kill the
    // process immediately, possibly before the pool closes.
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
