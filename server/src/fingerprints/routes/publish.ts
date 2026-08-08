// publish.ts — PUT /fingerprints. Saves one machine's snapshot for one project.
// -> Thin on purpose: the real work is the database write in queries.ts (see also ADR 0010).

import type {Request, Response} from 'express'
import { upsertFingerprint } from '../queries.js'

export async function handlePublishFingerprint( req: Request, res: Response) {
    const {
        project_id,
        node_version,
        os_arch,
        lockfile_hash,
        applied_migrations
    } = req.body; // already screened by validateBody(publishFingerprintSchema)

    // These names have to be spelled exactly like the keys the client sends, or they come back empty.
    // userId below is camelCase because that is a name we picked ourselves rather than one handed to us.
    // Mixing both styles in the call is fine — the order of the arguments is what matters, not their names.

    // The user's id is never taken from the request. It comes off their login token instead,
        // -> so nobody can publish a fingerprint while pretending to be somebody else.

    // The token keeps the id as text and the database column is a number, hence Number().
    const userId = Number(req.user!.sub);

    const fingerprint = await upsertFingerprint(
        userId,
        project_id,
        node_version,
        os_arch,
        lockfile_hash,
        applied_migrations
    )

    // Writing { fingerprint } is the same as writing { fingerprint: fingerprint }.
    // So the variable's name is the field name clients see, and contracts.md promises that name.
    // Rename the variable and every client breaks, with nothing to warn you.

    // Every success reply in this app looks like this: the thing itself, named after what it is.
    // Singular for one, plural for a list ({ incident } / { incidents }, { entry } / { entries }).
    // 200 rather than 201 because this either creates or updates and we cannot tell which — nor does the caller care.
    res.status(200).json({ fingerprint });

}
