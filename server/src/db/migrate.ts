import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import type { Pool } from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
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

    for (const file of pending) {
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      
      try {
        console.log(`Applying ${file}...`);
        await client.query(sql);
        
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pool } = await import('./pool.js');
  
  try {
    await runMigrations(pool);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
