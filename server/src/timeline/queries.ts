/**
 * queries.ts — all the DB reads/writes for the timeline routes. Handlers decide what happens;
 * these only touch the DB. No org filter here on purpose: the route calls findIncidentById(id, orgId)
 * first to confirm the incident is yours, so these can trust the incidentId they're handed.
 */

import { TimelineEntry, TimelineEntryType } from './types.js';
import { pool } from '../db/pool.js';

// append one entry, return it via RETURNING *. body is JSON.stringify'd for the JSONB column.
export async function insertTimelineEntry(
    incidentId: number,
    authorId: number | null, // null for system / ai_draft entries (no human author)
    type: TimelineEntryType,
    body: TimelineEntry['body']
): Promise<TimelineEntry> {
    const { rows } = await pool.query(
        'INSERT INTO timeline_entries (incident_id, author_id, type, body) VALUES ($1, $2, $3, $4) RETURNING *',
        [incidentId, authorId, type, JSON.stringify(body)]
    );
    return rows[0];
}

// Selects a specified singular entry in refrence from an id and incident id
export async function findTimelineEntryById(entryId: number, incidentId: number): Promise<TimelineEntry> {
    const { rows } = await pool.query(`SELECT * FROM timeline_entries 
        WHERE id = $1 
        AND incident_id = $2`,
        [entryId, incidentId]
    )
    return rows[0] ?? null
}

// oldest-first, chat-log order (what the UI wants). ORDER BY id, not arrival time — the id
// sequence is the ordering truth; the network can deliver out of order, the sequence can't.
export async function findTimelineEntriesByIncident(incidentId: number): Promise<TimelineEntry[]> {
    const { rows } = await pool.query(
        'SELECT * FROM timeline_entries WHERE incident_id = $1 ORDER BY id ASC',
        [incidentId]
    );
    return rows;
}

// reconnect gap-fill: entries newer than sinceId, oldest-first. > (not >=) skips the one they have.
export async function findTimelineEntriesSince(
    incidentId: number,
    sinceId: number
): Promise<TimelineEntry[]> {
    const { rows } = await pool.query(
        'SELECT * FROM timeline_entries WHERE incident_id = $1 AND id > $2 ORDER BY id ASC',
        [incidentId, sinceId]
    );
    return rows;
}

//Confirm query for and ai-draft; uses an UPDATE guard to stamp author_id into an actuall number value for an unconfirmed draft/row
export async function confirmAiDraft(
    entryId: number, 
    incidentId: number, 
    userId: number
): Promise<TimelineEntry | null> {
    const { rows } = await pool.query(
        `UPDATE timeline_entries
        SET author_id = $1
        WHERE id = $2
        AND incident_id = $3
        AND type = 'ai_draft'
        AND author_id IS null
        RETURNING *`,
        [userId, entryId, incidentId]
    );
    return rows[0] ?? null
}

//Rejecting/deleting an ai entry that no one will stand by
export async function rejectAiDraft(
    entryId: number, 
    incidentId: number 
): Promise<TimelineEntry | null> {
    const { rows } = await pool.query(
        `DELETE FROM timeline_entries
        WHERE id = $1
        AND incident_id = $2
        AND author_id IS null
        AND type = 'ai_draft'
        RETURNING *`,
        [entryId, incidentId]
    );
    return rows[0] ?? null
}