import type { Request, Response } from 'express';
import { findIncidentsByOrg } from '../queries.js';


export async function handleListIncidents(req: Request, res: Response) {
    
    const orgId = req.user!.org_id;

    const incidents = await findIncidentsByOrg(orgId);

    res.status(200).json({ incidents });
}


