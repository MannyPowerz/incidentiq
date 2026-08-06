/**
 * fingerprints.queries.test.ts — the upsert and the org-scoped read, tested straight through
 * pool.query with no HTTP in the way.
 *
 * This runs before any route exists on purpose. The DO UPDATE set-list is the one part of this
 * feature that can be wrong without throwing, so it gets proven while it is still five lines.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { upsertFingerprint, findFingerprintsByProject } from '../src/fingerprints/queries.js';

// machine_fingerprints.user_id is a NOT NULL FK, so every test needs a real user row.
// tests/setup.ts truncates users and machine_fingerprints after each test; orgs survive.
async function seedUser(email: string, orgId: number): Promise<number> {
    const {
        rows: [user],
    } = await pool.query(
        `INSERT INTO users (email, password_hash, role, org_id) VALUES ($1, 'hash', 'responder', $2) RETURNING id`,
        [email, orgId]
    );
    return user.id;
}

// microsecond-resolution read, since JS Dates round to the millisecond and would hide a real move.
// pg returns NUMERIC as a string to avoid float loss, hence the parse.
async function readUpdatedAtEpoch(userId: number): Promise<number> {
    const { rows } = await pool.query(
        'SELECT EXTRACT(EPOCH FROM updated_at) AS epoch FROM machine_fingerprints WHERE user_id = $1',
        [userId]
    );
    return Number(rows[0].epoch);
}

describe('fingerprint queries', () => {
    let orgId: number;
    let userId: number;

    beforeEach(async () => {
        const {
            rows: [org],
        } = await pool.query('SELECT id FROM orgs LIMIT 1');
        orgId = org.id;
        userId = await seedUser('publisher@example.com', orgId);
    });

    it('inserts on first publish', async () => {
        const fp = await upsertFingerprint(userId, 'incidentiq', '22.11.0', 'darwin-arm64', 'sha256:aaa', [
            '0001_orgs_users.sql',
        ]);

        expect(fp.id).toBeTypeOf('number');
        expect(fp.user_id).toBe(userId);
        expect(fp.node_version).toBe('22.11.0');
        expect(fp.applied_migrations).toEqual(['0001_orgs_users.sql']);
    });

    // the reason ON CONFLICT is here at all: republishing must overwrite, never accumulate.
    it('republishing updates in place instead of adding a row', async () => {
        await upsertFingerprint(userId, 'incidentiq', '22.11.0', 'darwin-arm64', 'sha256:aaa', ['0001']);
        const second = await upsertFingerprint(userId, 'incidentiq', '20.18.1', 'linux-x64', 'sha256:bbb', [
            '0001',
            '0002',
        ]);

        const { rows } = await pool.query('SELECT id FROM machine_fingerprints WHERE user_id = $1', [userId]);
        expect(rows).toHaveLength(1);
        expect(second.node_version).toBe('20.18.1');
        expect(second.applied_migrations).toEqual(['0001', '0002']);
    });

    // ADR 0010's full-replace call. A merge would leave the old lockfile beside the new node
    // -> version, describing a machine that never existed.
    it('nulls a field the republish omitted rather than keeping the old value', async () => {
        await upsertFingerprint(userId, 'incidentiq', '22.11.0', 'darwin-arm64', 'sha256:aaa', ['0001']);
        const second = await upsertFingerprint(userId, 'incidentiq', '20.18.1', null, null, null);

        expect(second.os_arch).toBeNull();
        expect(second.lockfile_hash).toBeNull();
        expect(second.applied_migrations).toBeNull();
    });

    // the silent one. Without `updated_at = now()` in the SET list this stays at the insert time
    // -> forever, because a column DEFAULT fires on INSERT and never on UPDATE.
    // Read as an epoch rather than comparing the JS Dates: Date.getTime() is milliseconds, Postgres
    // -> stores microseconds, and two publishes land inside the same millisecond.
    it('moves updated_at on republish', async () => {
        await upsertFingerprint(userId, 'incidentiq', '22.11.0', null, null, null);
        const before = await readUpdatedAtEpoch(userId);

        await upsertFingerprint(userId, 'incidentiq', '20.18.1', null, null, null);
        const after = await readUpdatedAtEpoch(userId);

        expect(after).toBeGreaterThan(before);
    });

    // a real SQL NULL, not the JSON null that JSON.stringify(null) would have produced.
    it('stores an omitted applied_migrations as SQL NULL', async () => {
        await upsertFingerprint(userId, 'incidentiq', null, null, null, null);

        const { rows } = await pool.query(
            'SELECT applied_migrations IS NULL AS sql_null FROM machine_fingerprints WHERE user_id = $1',
            [userId]
        );
        expect(rows[0].sql_null).toBe(true);
    });

    // the constraint is on the pair, so one user publishing two projects is two rows, not a conflict.
    it('keeps one row per project for the same user', async () => {
        await upsertFingerprint(userId, 'incidentiq', '22.11.0', null, null, null);
        await upsertFingerprint(userId, 'other-project', '18.0.0', null, null, null);

        const { rows } = await pool.query('SELECT id FROM machine_fingerprints WHERE user_id = $1', [userId]);
        expect(rows).toHaveLength(2);
    });

    it('returns every publisher in the org for one project, with their email', async () => {
        const teammate = await seedUser('teammate@example.com', orgId);
        await upsertFingerprint(userId, 'incidentiq', '22.11.0', null, null, null);
        await upsertFingerprint(teammate, 'incidentiq', '20.18.1', null, null, null);

        const found = await findFingerprintsByProject('incidentiq', orgId);

        expect(found).toHaveLength(2);
        expect(found.map((f) => f.published_by).sort()).toEqual([
            'publisher@example.com',
            'teammate@example.com',
        ]);
    });

    it('returns an empty array when nobody has published, not null', async () => {
        const found = await findFingerprintsByProject('never-published', orgId);
        expect(found).toEqual([]);
    });

    // the tenant boundary. It lives in a JOIN here rather than a WHERE on the table, so it is
    // -> worth proving rather than assuming.
    it("never returns another org's fingerprints", async () => {
        const {
            rows: [otherOrg],
        } = await pool.query("INSERT INTO orgs (name) VALUES ('Other Org') RETURNING id");
        const outsider = await seedUser('outsider@example.com', otherOrg.id);

        try {
            await upsertFingerprint(userId, 'incidentiq', '22.11.0', null, null, null);
            await upsertFingerprint(outsider, 'incidentiq', '99.0.0', null, null, null);

            const found = await findFingerprintsByProject('incidentiq', orgId);

            expect(found).toHaveLength(1);
            expect(found[0].published_by).toBe('publisher@example.com');
        } finally {
            // orgs is not truncated between tests (schema.test.ts asserts exactly one), and the
            // -> FK to orgs is ON DELETE RESTRICT, so users have to go first.
            await pool.query('DELETE FROM machine_fingerprints WHERE user_id = $1', [outsider]);
            await pool.query('DELETE FROM users WHERE id = $1', [outsider]);
            await pool.query('DELETE FROM orgs WHERE id = $1', [otherOrg.id]);
        }
    });
});
