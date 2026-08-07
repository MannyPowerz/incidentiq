// list.ts — GET /fingerprints?project=. Returns every publisher in the caller's org for one project,
// -> which is the two-sided read a machine-to-machine comparison needs. No 404: an empty array means
// -> nobody has published, and a project is not a resource this API owns (ADR 0010).

import type { Request, Response } from 'express'
import { findFingerprintsByProject } from '../queries.js'

export async function handleListFingerprints(req: Request, res: Response) {

    const projectId = req.query.project; // untrusted: Express does not promise this is a string


    // typeof, not truthiness: Express's qs parser turns ?project=a&project=b into an array and
    // -> ?project[x]=1 into an object, and findFingerprintsByProject wants a string.
    // It also narrows — TypeScript treats projectId as string below, so no cast is needed.
    // Coercing with String() would be worse than rejecting: String(['a','b']) is 'a,b', a real query.
    if (typeof projectId !== 'string') {
        res.status(400).json({
            error: 'project_required',
            message: 'A project query parameter is required'
        });
        return;
    }

    // org_id, where publish.ts used sub: a write is user-scoped, a read is org-scoped.
    // Off the token because a client-supplied org would let anyone read another tenant's rows.
    const orgId = req.user!.org_id;

    const fingerprints = await findFingerprintsByProject(
        projectId,
        orgId
    );


    res.status(200).json({ fingerprints });

}