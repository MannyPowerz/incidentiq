/**
 * types.ts — client mirrors of the server's row types, as they arrive over the wire.
 *
 * Hand-copied, with the source file named on each, because client and server are separate
 * packages with no shared types module. Two deliberate differences from the server files:
 *   - ids are number (BIGSERIAL, parsed to number by server/src/db/pool.ts) — the old mocks used "ROOM-0001"
 *   - timestamps are string, not Date — JSON has no Date type, so the client receives ISO strings
 * When a server shape changes, the mirror here changes in the same PR.
 */

// server/src/auth/types.ts + the incidents CHECKs in migration 0002
export type Severity = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'detected' | 'investigating' | 'mitigated' | 'resolved' | 'postmortem';

// server/src/timeline/types.ts
export type EntryType = 'observation' | 'action' | 'finding' | 'system' | 'ai_draft';
// the subset the POST route accepts — system and ai_draft have no human author (ADR 0014)
export type ClientPostableType = 'observation' | 'action' | 'finding';

export const SEVERITIES: readonly Severity[] = ['P1', 'P2', 'P3', 'P4'];
export const CLIENT_POSTABLE_TYPES: readonly ClientPostableType[] = ['observation', 'action', 'finding'];

// server/src/auth/types.ts `Incidents`
export interface Incident {
    id: number;
    title: string;
    status: IncidentStatus;
    org_id: number;
    severity: Severity;
    created_by: number | null;
    created_at: string;
    affected_system: string | null;
    resolved_at: string | null;
}

// server/src/timeline/types.ts `TimelineEntry`
export interface TimelineEntry {
    id: number;
    incident_id: number;
    // null for 'system' and for an 'ai_draft' nobody has confirmed yet
    author_id: number | null;
    type: EntryType;
    // JSONB; shape varies by type and is not pinned down at Minimum — read it through a guard
    body: Record<string, unknown>;
    locked: boolean;
    created_at: string;
}

// server/src/ai/types.ts `aiDraftSchema` — what body holds when type === 'ai_draft'
export interface AiDraftBody {
    summary: string;
    why_it_matters: string;
    likely_fix: string;
}

// server/src/fingerprints/types.ts
export interface MachineFingerprint {
    id: number;
    user_id: number;
    project_id: string;
    node_version: string | null;
    os_arch: string | null;
    lockfile_hash: string | null;
    applied_migrations: string[] | null;
    updated_at: string;
}

export interface FingerprintWithPublisher extends MachineFingerprint {
    // users.email — never null; both the column and its FK are NOT NULL
    published_by: string;
}
