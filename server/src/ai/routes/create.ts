import { Request, Response } from "express";
import { findIncidentById } from "../../incidents/queries.js";
import { draftFromContext } from "../draftFromContext.js";
import type { postAiDraft } from "./index.js";
import { AiDraftValidationError, AiDraftProviderError, AiDraftRequest, type ErrorResponse, AiDraft } from "../types.js";

export async function handleCreateAiDraft(req:Request<{id: string}, any, postAiDraft>, res:Response<ErrorResponse | AiDraft>) {
    const incidentId = Number(req.params.id)//the id we will reference from mounted POST handler
    const orgId = req.user!.org_id//! tells that the user exist during compile time and that it's not null

    const {context, kind} = req.body//authenticated by validateBody(postAiDraftSchema)

    /**
     * Org Gate: this layer of protection makes sure to prevent any unnecessay spending on our Gemeni model towards an incident 
     * that doesn't belong to a user or more concerning, doesn't exist
     * This makes sure that incident(title, severity, affected_system) is free; meaning optional fields to aiDraftRequestSchema
     * and teaching buildPrompt() to keep them possiblly-absent
    */
    const incident = await findIncidentById(incidentId, orgId)

    //made sure to replicate timeline's create.ts error_notification on scarce incidents to keep messaging consistent
    if(!incident) {
        res.status(404).json({
            error: 'incident_not_found',
            message: 'No incident with that id'
        })
        return
    }

    //Builds identical input to what draftFromContext roze it's contract around
    const draftRequest: AiDraftRequest = {
        incidentId: incidentId,
        context: context,
        kind: kind
    }
    try {
        const draft = await draftFromContext(draftRequest)

        //hands the draft back for a human to approve first before we insertTimelineEntry and no io.to(<incident>).emit
        res.status(200).json(draft)//!201: no write; nothing was created
    }catch(err) {
        if(err instanceof AiDraftValidationError) {
            res.status(400).json({error: 'invalid_schema_structure', message: 'Provider gave invalid schema payload'})
            return
        }

        if(err instanceof AiDraftProviderError) {
            res.status(504).json({error: 'upstream_error', message: 'Difficulty in responsiveness to the server'})//504: when the upstream never responded
            return
        }

        /**draftFromContext also throw an error for an empty AI_MODEL_NAME in a plain error. Making sure to err.cause it before it disappears*/
        if(!process.env.AI_MODEL_NAME) {
            throw new AiDraftProviderError(`'AI_MODEL_NAME is not set — copy .env.example to .env and set a Gemini model id'`, {cause: err})
        }
        return
    }
}