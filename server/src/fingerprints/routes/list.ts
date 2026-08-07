// list.ts — GET /fingerprints?project=. Hands back everyone on your team who has published for
// -> one project, which is what lets two machines be compared side by side.
// Never a 404: an empty list just means nobody has published yet (ADR 0010).

import type { Request, Response } from 'express'
import { findFingerprintsByProject } from '../queries.js'

export async function handleListFingerprints(req: Request, res: Response) {

    const projectId = req.query.project; // untrusted: Express does not promise this is a string


    // A client can send ?project= twice, or with brackets, and Express hands back a list or an object
    // -> instead of plain text — so check the type rather than just checking something is there.

    // Checking the type also tells TypeScript it is text from here down, so nothing needs forcing.
    // Forcing it would be worse than rejecting it: a list of ['a','b'] turns into the text 'a,b',
    // -> and we would quietly go looking for a project by that name instead of saying no.
    if (typeof projectId !== 'string') {
        res.status(400).json({
            error: 'project_required',
            message: 'A project query parameter is required'
        });
        return;
    }

    // Publishing uses the person's id; reading uses their team's, since you compare against teammates.
    // It comes off the login token because if the client could name a team, anyone could read another's.
    const orgId = req.user!.org_id;

    const fingerprints = await findFingerprintsByProject(
        projectId,
        orgId
    );


    res.status(200).json({ fingerprints });

}
