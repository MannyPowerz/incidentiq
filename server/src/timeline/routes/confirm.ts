import {Request, Response } from 'express'
import type { ErrorResponse } from '../../ai/types.js';
import type { TimelineEntry } from '../types.js';
import { io } from '../../socketServer.js';
import { findIncidentById } from '../../incidents/queries.js';
import { confirmAiDraft} from '../queries.js';
import { findTimelineEntryById } from '../queries.js';
import { formatRoomName } from '../../Socket/socketHandlers/formatJoin.js';

/** 
 * confirm.ts - Sources the confirm handler that goes through an org gate -> calls the guarded update 
 * query to stamp author_id => distinguishes the nullable types for an unidentified entry and an already confirmed ai_draft entry -> 
 * broadcasting to the room -> to then a status code of 200
*/
export async function handleConfirmAiDraft(
    req: Request<{id: string, entry_id: string}, any, {org_id: number, sub: number}>, 
    res: Response<ErrorResponse | TimelineEntry>) {
    const incidentId = Number(req.params.id);
    const entryId = Number(req.params.entry_id)
    const orgId = req.user!.org_id
    const userId = Number(req.user!.sub)

    const incident = await findIncidentById(incidentId, orgId);
    if(!incident) {
        res.status(404).json({
            error: 'incident_not_found',
            message: 'No incident with that id'
        });
        return
    }

    const confirmed = await confirmAiDraft(entryId, incidentId, userId);

    //when draft is null, it diagnosis the difference between if it's nonexistent or if someone has already claimed it
    if(!confirmed) {
        /**
         * Decided on findTimelineEntryById to query a single entry, regardless of it's type or author_id(confirmation state).
         * That is the point, when trying to find out why trying to confirm the entry failed.
         */
        const  existing = await findTimelineEntryById(entryId, incidentId)

        //checks it exist
        if(!existing) {
            res.status(404).json({
                error: 'entry_not_found',
                message: 'No entry with that id'
            });
            return
        }

        //checks if it's actually an ai_draft
        if(existing.type !== 'ai_draft') {
            res.status(409).json({
                error: 'not_ai_draft',
                message: 'Not an ai draft entry'
            });
            return
        }

        //this guard confirms that author_id is not null and that draft already has an approved owner
        if(existing.author_id !== null) {
            res.status(409).json({
                error: 'already_approved',
                message: 'ai_draft entry was already approved'
            });
            return
        }

        //if none of the conditions are met, we conclude to an internal error within our server
        res.status(500).json({error:'internal_error', message: 'server issue failure'})
        return
    }

    io.to(formatRoomName(incidentId)).emit('confirm-draft', confirmed)

    res.status(200).json(confirmed)
}