/**
 * routes/index.ts — the fingerprint endpoints and the shape their bodies must have.
 *
 * Same layout as incidents/routes/index.ts: schemas declared here, handlers imported, one line
 * per route. Mounted at /fingerprints in index.ts, which is why both paths below are '/'.
 */

import { z } from 'zod';
import { Router } from 'express';
import { requireAuth, validateBody } from '../../auth/middleware.js' ;
import { handlePublishFingerprint } from './publish.js'
import { handleListFingerprints } from './list.js'


// .nullable().default(null), not .optional(): under full-replace (ADR 0010) a field the agent left
// -> out and a field it explicitly nulled both mean "store null", so the distinction buys nothing.
// Filling them in here means the handler is handed an empty value rather than a missing one, which
// -> is what the database column expects, instead of four extra checks further along.
// That only works because validateBody passes on what the schema produced — see the note there.
export const publishFingerprintSchema = z.object({
    project_id: z.string().min(1),
    node_version: z.string().nullable().default(null),
    os_arch: z.string().nullable().default(null),
    lockfile_hash: z.string().nullable().default(null),
    applied_migrations: z.array(z.string()).nullable().default(null),
});

export const fingerprintsRouter = Router();

// requireAuth first on both: each handler reads req.user! and would throw without it.
// Applied per route rather than router.use, matching incidents — easy to forget on a new line, so check it.
fingerprintsRouter.put('/', requireAuth, validateBody(publishFingerprintSchema), handlePublishFingerprint);

// no validateBody: a GET has no body. The ?project= check is hand-rolled in the handler, since
// -> validateBody only screens req.body and no query-param middleware exists (ADR 0010).
fingerprintsRouter.get('/', requireAuth, handleListFingerprints);




