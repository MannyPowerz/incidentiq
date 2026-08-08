/**
 * queries.ts — all the DB reads/writes for the fingerprint routes. Handlers decide what happens;
 * these only touch the DB.
 *
 * The org filter is a JOIN, not a WHERE: machine_fingerprints has no org_id column, so the
 * -> tenant boundary is reached through users. Reads like a missing filter otherwise.
 */
import type { MachineFingerprint, FingerprintWithPublisher } from './types.js';
import { pool } from '../db/pool.js';

// publish or republish one machine's snapshot. One statement, so concurrent publishes can't race.
//
//   ON CONFLICT ON CONSTRAINT
//     Must name a real unique constraint; migration 0004 declared this one for exactly this statement.
//
//   DO UPDATE SET
//     EXCLUDED is the row the INSERT tried to add — taking that side everywhere is full replace (ADR 0010).
//     The key columns are absent because they matched, so they are already equal.
//
//   updated_at = now()
//     Set by hand because a column DEFAULT fires on INSERT only, never on UPDATE (ADR 0003).
//     now() over a JS Date keeps both branches on Postgres' clock.
//
//   RETURNING *
//     Generated id and fresh timestamp in the same round trip; no follow-up SELECT.
export async function upsertFingerprint(
    userId: number,
    projectId: string,
    nodeVersion: string | null,
    osArch: string | null,
    lockfileHash: string | null,
    appliedMigrations: string[] | null
): Promise<MachineFingerprint> {
    // { rows } destructures pg's Result — it also carries rowCount, command, and fields.
    const { rows } = await pool.query(
        `INSERT INTO machine_fingerprints (user_id, project_id, node_version, os_arch, lockfile_hash, applied_migrations)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ON CONSTRAINT machine_fingerprints_user_project_key DO UPDATE SET
             node_version = EXCLUDED.node_version,
             os_arch = EXCLUDED.os_arch,
             lockfile_hash = EXCLUDED.lockfile_hash,
             applied_migrations = EXCLUDED.applied_migrations,
             updated_at = now()
         RETURNING *`,
        [
            userId,
            projectId,
            nodeVersion,
            osArch,
            lockfileHash,
            // null stays null: JSON.stringify(null) is a JSON null, which `IS NULL` won't match.
            appliedMigrations === null ? null : JSON.stringify(appliedMigrations),
        ]
    );
    return rows[0];
}

// both sides of a machine-to-machine comparison. Empty array is a real answer, not a 404.
//
//   SELECT f.*, u.email AS published_by
//     f.* not *, or the join would return users.password_hash too.
//     The alias names the field for its role, so a later switch to a display name won't change the contract.
//
//   JOIN users u ON u.id = f.user_id
//     The FK is the bridge to users, which is where org_id lives since this table has none.
//     Plain JOIN, not LEFT: user_id is NOT NULL and FK-checked, so every fingerprint has a user.
//
//   WHERE f.project_id = $1 AND u.org_id = $2
//     Two tables, two facts — project belongs to the fingerprint, org to whoever published it.
//     u.org_id is the tenant boundary, reached one table over.
//
//   ORDER BY f.user_id
//     Presentation stability only, unlike the timeline's ORDER BY id which enforces sequencing.
export async function findFingerprintsByProject(
    projectId: string,
    orgId: number
): Promise<FingerprintWithPublisher[]> {
    const { rows } = await pool.query(
        `SELECT f.*, u.email AS published_by
         FROM machine_fingerprints f
         JOIN users u ON u.id = f.user_id
         WHERE f.project_id = $1 AND u.org_id = $2
         ORDER BY f.user_id`,
        [projectId, orgId]
    );
    return rows;
}
