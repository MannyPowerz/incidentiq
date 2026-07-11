import { describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';

describe('Minimum schema', () => {
  it('seeds exactly one org for the demo team', async () => {
    const { rows } = await pool.query('SELECT name FROM orgs');
    expect(rows).toEqual([{ name: 'Demo Team' }]);
  });

  it('rejects an invalid users.role via CHECK constraint', async () => {
    const {
      rows: [org],
    } = await pool.query('SELECT id FROM orgs LIMIT 1');

    await expect(
      pool.query(
        `INSERT INTO users (email, password_hash, role, org_id)
         VALUES ('a@example.com', 'hash', 'not-a-role', $1)`,
        [org.id]
      )
    ).rejects.toThrow();
  });

  it('enforces the timeline_entries -> incidents foreign key', async () => {
    await expect(
      pool.query(
        `INSERT INTO timeline_entries (incident_id, author_id, type, body)
         VALUES (999999, 999999, 'observation', '{}'::jsonb)`
      )
    ).rejects.toThrow();
  });

  it('orders timeline entries by (incident_id, id), matching the sort invariant', async () => {
    const {
      rows: [org],
    } = await pool.query('SELECT id FROM orgs LIMIT 1');
    const {
      rows: [user],
    } = await pool.query(
      `INSERT INTO users (email, password_hash, role, org_id)
       VALUES ('b@example.com', 'hash', 'responder', $1) RETURNING id`,
      [org.id]
    );
    const {
      rows: [incident],
    } = await pool.query(
      `INSERT INTO incidents (org_id, title, severity, created_by)
       VALUES ($1, 'Test incident', 'P2', $2) RETURNING id`,
      [org.id, user.id]
    );

    for (const body of ['first', 'second', 'third']) {
      await pool.query(
        `INSERT INTO timeline_entries (incident_id, author_id, type, body)
         VALUES ($1, $2, 'observation', $3::jsonb)`,
        [incident.id, user.id, JSON.stringify(body)]
      );
    }

    const { rows } = await pool.query(
      'SELECT body FROM timeline_entries WHERE incident_id = $1 ORDER BY incident_id, id',
      [incident.id]
    );
    expect(rows.map((r) => r.body)).toEqual(['first', 'second', 'third']);
  });
});
