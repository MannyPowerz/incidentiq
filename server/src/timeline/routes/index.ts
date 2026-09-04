// routes/index.ts — bundles the timeline endpoints into one router.
// Mounted at /incidents/:id/timeline in index.ts; POST adds an entry, GET reads them.

import { z } from 'zod'
import { Router } from 'express'
import { requireAuth, validateBody } from '../../auth/middleware.js';
import { handleCreateTimelineEntry } from './create.js';
import { handleListTimelineEntries } from './get.js'

// type is narrower than the DB CHECK on purpose: 'system' and 'ai_draft' have no human author
// (migration 0002), but nothing enforced that until now — this route stamped the caller's token
// -> as author_id regardless of type, so any client could POST an 'ai_draft' and get a row that
// -> is machine-typed with a human author_id. Excluding both here makes that row unreachable
// -> through this route instead of relying on a branch further down to catch it (ADR 0014).
// The machine paths insert directly via insertTimelineEntry, which already accepts a null author.
// body is left permissive (z.record) because its shape varies by entry type and isn't pinned down
// at Minimum.
const postTimelineEntrySchema = z.object({
    type: z.enum([
        'observation',
        'action',
        'finding'
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