import type { Request, Response } from 'express';
import { resolveIncident } from '../queries.js';

export async function handleResolveIncident(req: Request, res: Response) {
  const id = Number(req.params.id); // path params are strings — resolveIncident wants a number
  const orgId = req.user!.org_id; // scopes the write to your org — set by requireAuth from the token

  const { status } = req.body; // already screened by validateBody(patchIncidentSchema) in routes/index.ts

  // Minimum tier: 'resolved' is the only status transition we've built.
  // The route shape is generic on purpose — PATCH accepts any status — but wiring every transition now is Complete-tier work we're deferring.
  // A valid-but-unbuilt status is turned away with a 400 here, not silently ignored, so a client never thinks a no-op succeeded.
  // When the full lifecycle lands, this single guard becomes the branch (or lookup table) routing investigating / mitigated / postmortem each to its own update.
  if (status !== 'resolved') {
    res.status(400).json({
      error: 'unsupported_status',
      message: "Only 'resolved' is supported right now",
    });
    return;
  }

  const incident = await resolveIncident(id, orgId);

  // null means the incident is gone OR belongs to another org. Same 404 for both, with a generic
  // message, so a caller can't tell "not yours" apart from "doesn't exist" and probe other orgs.
  if (!incident) {
    res.status(404).json({
      error: 'incident_not_found',
      message: 'No incident with that id',
    });
    return;
  }

  // 200, not 201: this updates an existing incident, it doesn't create a new resource.
  res.status(200).json({ incident });
}
