import type { Request, Response } from 'express';
import { insertIncident } from '../queries.js';




export async function handleCreateIncident(req: Request, res: Response) {
    const { title, severity, affected_system } = req.body; // already screened by validateBody(createIncidentSchema)

    const orgId = req.user!.org_id; // set by requireAuth from the verified access token — identity comes from the token, never the body

    const createdBy = req.user!.sub; // the author's id — also off the token
    const authorId = Number(createdBy); // sub is a STRING in AccessTokenPayload; insertIncident wants a number

    // affected_system ?? null: the schema allows it to be absent (string | undefined),
    // but the column is nullable (string | null) — so turn "missing" into an explicit null
    const incident = await insertIncident(title, severity, orgId, authorId, affected_system ?? null);

    res.status(201).json({ incident });
}

