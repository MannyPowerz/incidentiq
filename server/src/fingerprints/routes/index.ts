/**
 * routes/index.ts — the fingerprint endpoints and the shape their bodies must have.
 *
 * Same layout as incidents/routes/index.ts: schemas declared here, handlers imported, one line
 * per route. The route wiring lands once the handlers exist.
 */

import { z } from 'zod';

// .nullable().default(null), not .optional(): under full-replace (ADR 0010) a field the agent left
// -> out and a field it explicitly nulled both mean "store null", so the distinction buys nothing.
// Converting here means the handler never sees undefined, and the validated body already matches
// -> MachineFingerprint's `string | null` instead of needing four `?? null` fixups downstream.
export const publishFingerprintSchema = z.object({
    project_id: z.string().min(1),
    node_version: z.string().nullable().default(null),
    os_arch: z.string().nullable().default(null),
    lockfile_hash: z.string().nullable().default(null),
    applied_migrations: z.array(z.string()).nullable().default(null),
});
