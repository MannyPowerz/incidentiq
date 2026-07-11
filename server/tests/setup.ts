import { afterAll, afterEach } from 'vitest';
import { pool } from '../src/db/pool.js';

afterEach(async () => {
  await pool.query(
    'TRUNCATE TABLE timeline_entries, machine_fingerprints, incidents, users RESTART IDENTITY CASCADE'
  );
});

afterAll(async () => {
  await pool.end();
});
