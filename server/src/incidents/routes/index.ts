/**
 * routes/index.ts — bundles the incident endpoints into one router.
 *
 * Same shape as auth/routes/index.ts: the request-shape check (validateBody) runs before the
 * handler, and the schema it uses is defined right here. This router gets mounted at /incidents
 * in index.ts. Only create exists for now — list/get/resolve slot in as their handlers are built.
 */

import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, validateBody } from '../../auth/middleware.js';

import { handleCreateIncident } from './create.js';
import { handleGetIncident } from './get.js';
import { handleResolveIncident } from './resolve.js';
import { handleListIncidents } from './list.js';

// the fields a client is allowed to supply when opening an incident. org_id, created_by, and
// status are deliberately NOT here — identity comes from the token, and status defaults in the DB.
const createIncidentSchema = z.object({
    title: z.string().min(1), // non-empty
    severity: z.enum(['P1', 'P2', 'P3', 'P4']), // closed set — mirrors the DB CHECK
    affected_system: z.string().optional(), // may be absent; the handler turns absent into null
});

const patchIncidentSchema = z.object({
    status: z.enum(['detected', 'investigating', 'mitigated', 'resolved', 'postmortem']),
});

export const incidentRouter = Router();

// requireAuth runs FIRST — unlike register/login, you must already be logged in to open an
// incident, and requireAuth is what populates req.user so the handler can read org_id/sub off it.
incidentRouter.post('/', requireAuth, validateBody(createIncidentSchema), handleCreateIncident);

incidentRouter.get('/:id', requireAuth, handleGetIncident);

incidentRouter.patch('/:id', requireAuth, validateBody(patchIncidentSchema), handleResolveIncident);

incidentRouter.get('/', requireAuth, handleListIncidents);
