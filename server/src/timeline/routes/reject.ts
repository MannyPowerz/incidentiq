import { Response, Request } from "express";
import { io } from "../../socketServer.js";
import { ErrorResponse } from "../../ai/types.js";
import { findIncidentById } from "../../incidents/queries.js";
import { findTimelineEntryById, rejectAiDraft } from "../queries.js";
import { formatRoomName } from "../../Socket/socketHandlers/formatJoin.js";
import { TimelineEntry } from "../types.js";

/** 
 * Same spine as handleConfirmAiDraft; rejects/deletes according to following: Org gate -> calls rejectAiDraft() -> defines the null branch
 * -> broadcast the entry that was deleted to everyone in the room -> respond including a status code of 200.
*/
export async function handleRejectAiDraft(
    req: Request<{entryId: string, incidentId: string}, ErrorResponse | TimelineEntry, {}, {org_id: number, userId: number}>, 
    res: Response<ErrorResponse | TimelineEntry>) {
    const entryId = Number(req.params.entryId);
    const incidentId = Number(req.params.incidentId);
    const orgId = req.user!.org_id;

    const incident = await findIncidentById(incidentId, orgId);

    if(!incident) {
        res.status(404).json({
            error: 'incident_not_found',
            message: 'No incident with that id'
        });
        return
    }

    //These gaurds go through the same process as handleConfirmAiDraft's guards checks before we deleting the entry to ensure we narrow 
    //to the correct entry
    const doesItExist = await findTimelineEntryById(entryId, incidentId)
    if(!doesItExist) {
        res.status(404).json({
            error: 'entry_not_found',
            message: 'No entry with that id'
        });
        return
    }

    if(doesItExist.type !== 'ai_draft') {
        res.status(409).json({
            error: 'not_ai_draft',
            message: 'Not an ai draft entry'
        });
        return
    }

    if(doesItExist.author_id !== null) {
        res.status(409).json({
            error: 'already_approved',
            message: 'ai_draft entry was already approved'
        });
        return
    }

    const rejected = await rejectAiDraft(entryId, incidentId)

    //This guard exist to theoretically handle the scenerio of someone request a confirm/reject on it between our check and delete
    if(!rejected) {
        res.status(409).json({
            error: 'configuration_error',
            message: 'ai_draft entry was already changed before it could be rejected'
        });
        return
    }

    //The room is broadcasting the whole entry if the id wasn't enough to distinguish what was deleted
    io.to(formatRoomName(incidentId)).emit('new-message', rejected)
    
    //status 200 instead of 204 beacuse we are deleting with a response body of the rejected entry
    res.status(200).json(rejected)
}