import 'dotenv/config';
import { Pool } from 'pg';
import { runMigrations } from '../src/db/migrate.js';

export default async function setup() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL is not set — copy .env.example to .env and point it at a local test database'
    );
  }

  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await runMigrations(pool);
  await pool.end();
}
