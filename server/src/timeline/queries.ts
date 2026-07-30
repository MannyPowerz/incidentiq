/**
 * queries.ts — every database read and write the timeline routes need, in one place.
 *
 * Same split as incidents/queries.ts: the handlers decide what happens, these functions are
 * the only things that touch the DB. No org filter in here on purpose — the route calls
 * findIncidentById(incidentId, orgId) first to confirm the incident is yours, then these
 * trust the incidentId they're handed.
 */

import { TimelineEntry, TimelineEntryType } from './types.js';
import { pool } from '../db/pool.js';

// append one entry and hand back the finished row (RETURNING *, one round trip).
// body is JSON.stringify'd because the column is JSONB: pg auto-stringifies a plain object, but
// doing it explicitly is correct for any shape (a JS array would otherwise be stored as a
// Postgres array literal, not JSON).
export async function insertTimelineEntry(
  incidentId: number,
  authorId: number | null, // the human author's id, or null for 'system' / 'ai_draft' entries
  type: TimelineEntryType,
  body: TimelineEntry['body']
): Promise<TimelineEntry> {
  const { rows } = await pool.query(
    'INSERT INTO timeline_entries (incident_id, author_id, type, body) VALUES ($1, $2, $3, $4) RETURNING *',
    [incidentId, authorId, type, JSON.stringify(body)]
  );
  return rows[0];
}

// all entries for an incident. ORDER BY id, never created_at or socket arrival time — the
// BIGSERIAL sequence is the ordering truth (the network reorders; the DB sequence doesn't).
// DESC = newest first. Note findTimelineEntriesSince returns ascending; the client sorts by id.
export async function findTimelineEntriesByIncident(incidentId: number): Promise<TimelineEntry[]> {
  const { rows } = await pool.query(
    'SELECT * FROM timeline_entries WHERE incident_id = $1 ORDER BY id DESC',
    [incidentId]
  );
  return rows;
}

// reconnect gap-fill: a client that last saw sinceId asks for everything newer.
// id > $2 (strictly greater) excludes the entry it already has; sinceId = 0 returns all (ids start at 1).
export async function findTimelineEntriesSince(
  incidentId: number,
  sinceId: number
): Promise<TimelineEntry[]> {
  const { rows } = await pool.query(
    'SELECT * FROM timeline_entries WHERE incident_id = $1 AND id > $2 ORDER BY id',
    [incidentId, sinceId]
  );
  return rows;
}
