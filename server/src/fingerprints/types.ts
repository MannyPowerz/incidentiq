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

// What GET /fingerprints?project= returns. The org filter already joins users, so the publisher's
// identity costs nothing extra to fetch — and a two-machine comparison is unreadable without it.
export interface FingerprintWithPublisher extends MachineFingerprint {
    published_by: string; // SQL: users.email AS published_by — never null; both the column and the FK are NOT NULL
}
