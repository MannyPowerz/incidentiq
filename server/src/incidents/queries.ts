/**
 * queries.ts — every database read and write the incident routes need, in one place.
 *
 * Same split as auth/queries.ts: the handlers decide what should happen, and these
 * functions are the only things that actually talk to the database (through the shared
 * pool). They hand back plain rows — no request/response here.
 *
 * The one rule running through all of them: every function takes an orgId and filters on
 * it. That's the tenant boundary — one org can never read or touch another org's incidents,
 * and it's enforced here in SQL, not hoped for up in the handler.
 */

import { pool } from '../db/pool.js';
import type { Incidents } from '../auth/types.js';

// create an incident and hand back the finished row. RETURNING * gives us that new row
// (with its id and defaults) in the same round trip. We don't pass status — the column
// defaults to 'detected' in the schema. created_by / affected_system may be null.
export async function insertIncident(
  title: string,
  severity: string,
  orgId: number,
  createdBy: number,
  affectedSystem: string | null
): Promise<Incidents> {
  const { rows } = await pool.query(
    'INSERT INTO incidents (title, severity, org_id, created_by, affected_system) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [title, severity, orgId, createdBy, affectedSystem]
  );
  return rows[0];
}

// find one incident by id — but only if it belongs to this org. null if it doesn't exist
// OR belongs to someone else; the handler treats both the same (a 404), so a caller can't
// even tell another org's incident apart from a missing one.
export async function findIncidentById(id: number, orgId: number): Promise<Incidents | null> {
  const { rows } = await pool.query(
    'SELECT * FROM incidents WHERE id = $1 AND org_id = $2',
    [id, orgId]
  );
  return rows[0] ?? null;
}

// list this org's incidents, newest first. ORDER BY id DESC uses the BIGSERIAL sequence
// as the clock — never socket arrival time or created_at ties (the id sequence is absolute).
export async function findIncidentsByOrg(orgId: number): Promise<Incidents[]> {
  const { rows } = await pool.query(
    'SELECT * FROM incidents WHERE org_id = $1 ORDER BY id DESC',
    [orgId]
  );
  return rows;
}

// resolve an incident: flip its status and stamp the resolve time in one write. The org_id
// in the WHERE is the guard — you can't resolve an incident that isn't yours. null back if
// nothing matched (gone, or not your org), which the handler turns into a 404.
export async function resolveIncident(id: number, orgId: number): Promise<Incidents | null> {
  const { rows } = await pool.query(
    "UPDATE incidents SET status = 'resolved', resolved_at = now() WHERE id = $1 AND org_id = $2 RETURNING *",
    [id, orgId]
  );
  return rows[0] ?? null;
}
