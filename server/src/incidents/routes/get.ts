import type { Request, Response } from 'express';

import { findIncidentById } from '../queries.js';

export async function handleGetIncident(req: Request, res: Response) {
    const id = Number(req.params.id); // path params are ALWAYS strings — convert to number

    const orgId = req.user!.org_id; // scopes the lookup to your org — the tenant guard

    const incident = await findIncidentById(id, orgId);

    if (!incident) {
        res.status(404).json({
            error: 'incident_not_found',
            message: 'No incident with that id',
        });

        return;
    }

    res.status(200).json({ incident });
}
