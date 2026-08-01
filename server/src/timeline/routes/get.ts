// handleListTimelineEntries — GET /incidents/:id/timeline: the whole timeline, or just the gap
// -> since ?since=<id> when a client reconnects. Same org gate as create.ts.

import { Request, Response } from "express";
import { findIncidentById } from '../../incidents/queries.js';
import { findTimelineEntriesSince, findTimelineEntriesByIncident } from "../queries.js";

export async function handleListTimelineEntries(req: Request, res: Response) {

    const incidentId = Number(req.params.id);
    const orgId = req.user!.org_id;

    // org gate: same 404 for missing or another org's incident, so nobody can probe which ids exist.
    const incident = await findIncidentById(incidentId, orgId);

    if (!incident) {
        res.status(404).json({ 
            error: 'incident_not_found',
            message: 'No incident with that id'
        });

        return;
    }

    const sinceParam = req.query.since; // untrusted (Express docs): usually a string, but can be absent or another shape

    let entries;

    // gap-fill vs full list: a reconnecting client sends ?since=<lastId> to get only what it missed;
    // no since → the whole timeline. A malformed since becomes NaN, and id > NaN is empty, not an error.
    if (sinceParam) {
        entries = await findTimelineEntriesSince(incidentId, Number(sinceParam));
    } else {
        entries = await findTimelineEntriesByIncident(incidentId);
    }

    res.status(200).json({ entries });
}


