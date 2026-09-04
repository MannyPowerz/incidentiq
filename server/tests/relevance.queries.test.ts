/**
 * relevance.queries.test.ts — findTeamRoster, tested straight through pool.query.
 *
 * The one thing that can be wrong here without throwing is the org filter: a roster that leaks a
 * teammate from another org would hand `scoreTeammates` a person who should never be ranked for
 * this team, and every downstream signal for them would be a fabricated share of files they were
 * never meant to be compared against.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { findTeamRoster } from '../src/relevance/queries.js';

async function seedUser(email: string, orgId: number): Promise<number> {
    const {
        rows: [user],
    } = await pool.query(
        `INSERT INTO users (email, password_hash, role, org_id) VALUES ($1, 'hash', 'responder', $2) RETURNING id`,
        [email, orgId]
    );
    return user.id;
}

describe('findTeamRoster', () => {
    let orgId: number;

    // orgs aren't truncated between tests (tests/setup.ts), so the seeded org is reused rather
    // than creating a fresh one every time. Only the isolation test below adds a second org, and
    // it cleans that one up itself.
    beforeEach(async () => {
        const {
            rows: [org],
        } = await pool.query('SELECT id FROM orgs LIMIT 1');
        orgId = org.id;
    });

    it('returns every user in the org, shaped as { user_id, email }', async () => {
        const userId = await seedUser('manny@example.com', orgId);

        const roster = await findTeamRoster(orgId);

        expect(roster).toEqual([{ user_id: userId, email: 'manny@example.com' }]);
    });

    it('is empty for an org with no users, not an error', async () => {
        const roster = await findTeamRoster(orgId);

        expect(roster).toEqual([]);
    });

    describe('org isolation', () => {
        let otherOrgId: number;

        // Self-contained rather than relying on tests/setup.ts's global truncate running first:
        // orgs.id is FK'd from users, so deleting the org before its users would throw and abort
        // -> every afterEach queued after it, silently skipping the truncate for the next test too.
        afterEach(async () => {
            await pool.query('DELETE FROM users WHERE org_id = $1', [otherOrgId]);
            await pool.query('DELETE FROM orgs WHERE id = $1', [otherOrgId]);
        });

        // the one thing that can be wrong without throwing: a leaked teammate from another org
        // -> would hand scoreTeammates someone who should never be ranked against this team.
        it('never includes a user from another org', async () => {
            const {
                rows: [otherOrg],
            } = await pool.query("INSERT INTO orgs (name) VALUES ('Other Org') RETURNING id");
            otherOrgId = otherOrg.id;

            await seedUser('outsider@example.com', otherOrgId);
            const insiderId = await seedUser('insider@example.com', orgId);

            const roster = await findTeamRoster(orgId);

            expect(roster).toEqual([{ user_id: insiderId, email: 'insider@example.com' }]);
        });
    });

    it('orders by id for stable output', async () => {
        const first = await seedUser('a@example.com', orgId);
        const second = await seedUser('b@example.com', orgId);

        const roster = await findTeamRoster(orgId);

        expect(roster.map((m) => m.user_id)).toEqual([first, second]);
    });
});
