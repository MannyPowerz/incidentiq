/**
 * queries.ts — the one database read scoring needs: everyone on an org's roster.
 *
 * `scoreTeammates` takes `TeamMember[]` as a plain argument rather than reaching into the database
 * itself, same as it takes `now` — the function stays pure and testable, and this is the one call
 * that produces the array in real use. Lives here rather than in auth/queries.ts because
 * `TeamMember` is this folder's type, not auth's, and fingerprints/queries.ts already sets the
 * precedent for a feature querying `users` directly instead of routing through auth.
 */

import { pool } from '../db/pool.js';
import type { TeamMember } from './types.js';

// Ordered by id for stable, deterministic output — same reasoning as findFingerprintsByProject's
// ORDER BY, presentation stability rather than an ordering invariant anything depends on.
export async function findTeamRoster(orgId: number): Promise<TeamMember[]> {
    // id AS user_id matches TeamMember's field name exactly, so pg's rows are already the right
    // shape — no mapping step below. Rename either side and this silently stops lining up.
    const { rows } = await pool.query(
        'SELECT id AS user_id, email FROM users WHERE org_id = $1 ORDER BY id',
        [orgId]
    );
    return rows;
}
