// routes/index.ts — bundles the timeline endpoints into one router.
// Mounted at /incidents/:id/timeline in index.ts; POST adds an entry, GET reads them.

import { z } from 'zod'
import { Router } from 'express'
import { requireAuth, validateBody } from '../../auth/middleware.js';
import { handleCreateTimelineEntry } from './create.js';
import { handleListTimelineEntries } from './get.js'

// the body a client may POST. type is a closed set (mirrors the DB CHECK); body is left permissive
// (z.record) because its shape varies by entry type and isn't pinned down at Minimum.
const postTimelineEntrySchema = z.object({
    type: z.enum([
        'observation',
        'action',
        'finding',
        'system',
        'ai_draft'
    ]),
    body : z.record(
        z.string(),
        z.unknown()
    )
});

// mergeParams: true is required — :id is captured by the /incidents/:id/timeline MOUNT (index.ts),
// -> one layer above this router. Without it, req.params.id inside the handlers is undefined, silently.
export const timelineRouter = Router({mergeParams: true});

timelineRouter.post('/', requireAuth, validateBody(postTimelineEntrySchema), handleCreateTimelineEntry);

// GET has no body, so no validateBody — requireAuth still gates it.
timelineRouter.get('/' , requireAuth, handleListTimelineEntries);