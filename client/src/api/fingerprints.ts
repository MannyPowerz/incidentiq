// fingerprints.ts — real. server/src/fingerprints/routes/*; full contract in docs/contracts.md

import { jsonInit, request } from './client';
import type { FingerprintWithPublisher, MachineFingerprint } from './types';

// every fingerprint for one project across the caller's org, ordered by user_id; [] means nobody published
export async function listFingerprints(project: string): Promise<FingerprintWithPublisher[]> {
    const { fingerprints } = await request<{ fingerprints: FingerprintWithPublisher[] }>(
        `/fingerprints?project=${encodeURIComponent(project)}`,
    );
    return fingerprints;
}

export type PublishFingerprintInput = {
    project_id: string;
    node_version?: string | null;
    os_arch?: string | null;
    lockfile_hash?: string | null;
    applied_migrations?: string[] | null;
};

/**
 * The agent's call, not the UI's: full-replace semantics (ADR 0010) mean an omitted field is
 * stored as null, so a screen calling this with a partial body would erase data. Kept here so the
 * layer covers every endpoint, but deliberately not re-exported from api/index.ts.
 */
export async function publishFingerprint(input: PublishFingerprintInput): Promise<MachineFingerprint> {
    const { fingerprint } = await request<{ fingerprint: MachineFingerprint }>('/fingerprints', jsonInit('PUT', input));
    return fingerprint;
}
