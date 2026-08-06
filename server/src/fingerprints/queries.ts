/**
 * queries.ts — all the DB reads/writes for the fingerprint routes. Handlers decide what happens;
 * these only touch the DB.
 *
 * The org filter is a JOIN, not a WHERE: machine_fingerprints has no org_id column, so the
 * -> tenant boundary is reached through users. Reads like a missing filter otherwise.
 */
import type { MachineFingerprint, FingerprintWithPublisher } from './types.js';
import { pool } from '../db/pool.js';

// publish or republish one machine's snapshot for one project.
// ON CONFLICT makes it a single atomic statement: a select-then-write would leave a window where
// -> two concurrent publishes both see "no row" and one dies on the unique constraint.
// Every column takes the EXCLUDED (incoming) side — full replace, so an omitted field lands as
// -> null rather than keeping a stale value that would make a Tier 2 diff wrong (ADR 0010).
// updated_at is set here rather than passed in: a column DEFAULT only fires on INSERT, so without
// -> this line the update branch would keep the original timestamp forever (ADR 0003).
export async function upsertFingerprint(
    userId: number,
    projectId: string,
    nodeVersion: string | null,
    osArch: string | null,
    lockfileHash: string | null,
    appliedMigrations: string[] | null
): Promise<MachineFingerprint> {
    // { rows } destructures pg's Result — it also carries rowCount, command, and fields; only the array is wanted.
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
            // null passes through unstringified, unlike timeline/queries.ts which always stringifies.
            // JSON.stringify(null) is the string 'null', which Postgres stores as a JSON null —
            // -> reads back the same, but `IS NULL` is false for it. A raw null stores a real SQL NULL.
            appliedMigrations === null ? null : JSON.stringify(appliedMigrations),
        ]
    );
    return rows[0];
}

// every fingerprint published for one project by anyone in the caller's org — the two sides a
// -> machine-to-machine comparison needs. Empty array, not null: "nobody published" is a real answer.
// f.* and not *: a bare * across this join returns users' columns too, password_hash included.
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
