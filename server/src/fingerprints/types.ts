// types.ts — the MachineFingerprint shape (mirrors the machine_fingerprints table).

export interface MachineFingerprint {
    id: number; // SQL: BIGSERIAL

    user_id: number; // SQL: BIGINT — scoped by user, not org: this table has no org_id, so GET reaches the tenant boundary through a JOIN to users

    project_id: string; // SQL: TEXT — bare identifier, no FK; a projects table was dropped as scope creep (ADR 0003)

    node_version: string | null; // SQL: TEXT, NULLABLE

    os_arch: string | null; // SQL: TEXT, NULLABLE

    lockfile_hash: string | null; // SQL: TEXT, NULLABLE

    applied_migrations: string[] | null; // SQL: JSONB — migration filenames, matching schema_migrations' PRIMARY KEY; MIGRATION_DRIFT is a set difference over these names, so timestamps are deliberately not stored here

    updated_at: Date; // SQL: TIMESTAMPTZ — refreshed by app code on every publish; the schema has no trigger for it on purpose (ADR 0003)
}
