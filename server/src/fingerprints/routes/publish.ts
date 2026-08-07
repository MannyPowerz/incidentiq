// publish.ts — PUT /fingerprints. Standard Express handler; the upsert it delegates to is where
// -> the real behaviour lives (full replace, updated_at refresh — see queries.ts and ADR 0010).

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
    
    // snake_case here is forced, not style: destructuring matches key names, and the body keys mirror
    // -> the SQL columns. Names TypeScript invents stay camelCase, which is why userId sits beside
    // -> project_id in the call below — arguments pass by position, so the two casings never collide.

    // user_id is deliberately absent from the destructure above and from the schema: identity comes
    // -> off the verified token, so a client cannot publish a fingerprint as somebody else.

    // Number() because sub is a string per the JWT spec, while the column is BIGINT.
    const userId = Number(req.user!.sub);

    const fingerprint = await upsertFingerprint(
        userId,
        project_id,
        node_version,
        os_arch,
        lockfile_hash,
        applied_migrations
    )

    // { fingerprint } is shorthand for { fingerprint: fingerprint }, so the VARIABLE name is the JSON
    // -> key contracts.md promises — rename it and every client breaks with no type error to catch it.

    // Matches how every success response here is built: the resource under its own name, singular or
    // -> plural to signal one vs many ({ incident } / { incidents }, { entry } / { entries }).
    // 200 and not 201 because an upsert cannot say which branch it took, and no caller needs to know.
    res.status(200).json({ fingerprint });

}