// FIXTURE: replace when GET /incidents/:id/timeline returns relevance per entry
//          (schedule.md "Relevance on page load" / "Wire relevance into entries").
//
// Why a fixture: server/src/relevance/ has tested scoring maths but no route calls it, no
// collector feeds it git history, and the reason generator was never written. Delete this file
// when the endpoint ships; api/relevance.ts is the only importer.

import type { RelevanceLine } from '../relevance';

const REASONS = [
    'Changed these files yesterday — most recent hands on this code.',
    'Wrote most of this module, though not recently.',
    'Has been working in this area all week.',
];

// deterministic from the ids so the same entry always shows the same line across renders and reloads
export function fixtureRelevance(incidentId: number, entryId: number): RelevanceLine | null {
    // every fifth entry has no relevant teammate — the "every score is zero" case the UI must render as a sentence
    if (entryId % 5 === 0) return null;
    const seed = incidentId + entryId;
    return {
        user_id: (seed % 3) + 1,
        reason: REASONS[seed % REASONS.length] ?? REASONS[0]!,
        score: Math.round(((seed % 7) + 3) * 10) / 100,
    };
}
