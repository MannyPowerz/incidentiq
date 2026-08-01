// handleCreateTimelineEntry — POST /incidents/:id/timeline: add one entry, then broadcast it live.
// The two steps that aren't boilerplate: the org gate (verify the incident is yours before writing)
// -> and the broadcast (fired only after the DB write lands).

import { Request, Response } from 'express'
import {insertTimelineEntry} from '../queries.js'
import { findIncidentById } from '../../incidents/queries.js';
import { io } from '../../socketServer.js';


export async function handleCreateTimelineEntry(req: Request, res: Response) {

    const incidentId = Number(req.params.id); // the :id from /incidents/:id/timeline

    const orgId = req.user!.org_id; // identity from the verified token, never the body
    const authorId = Number(req.user!.sub); // sub is a string in the token; the column wants a number

    const { type, body } = req.body; // already screened by validateBody(postTimelineEntrySchema)

    // org gate: confirm the incident exists AND is yours before writing to it. Same 404 whether it's
    //  -> missing or another org's, so a caller can't probe which ids exist — and it's what lets the
    //  -> timeline queries trust incidentId (they carry no org filter of their own).
    const incident = await findIncidentById(incidentId, orgId);
    
    if (!incident) {
        res.status(404).json({
            error: 'incident_not_found',
            message: 'No incident with that id'
        });

        return;
    }

    const entry = await insertTimelineEntry(incidentId, authorId, type, body);

    // broadcast AFTER the write succeeds — DB-write-before-broadcast. Room name matches
    // -> createRoom.ts's socket.join(String(incidentId)), so this reaches everyone already joined.
    io.to(String(incidentId)).emit('entry:new', entry);

    res.status(201).json({ entry });
}


