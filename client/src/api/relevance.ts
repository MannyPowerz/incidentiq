// relevance.ts — FIXTURE-BACKED. See fixtures/relevance.ts for why.
// Shape derived from server/src/relevance/types.ts: the top TeammateScore for an entry, plus the
// sentence ReasonFor would produce. Swapping to the real endpoint changes only getRelevance's body.

import { fixtureRelevance } from './fixtures/relevance';

export interface RelevanceLine {
    // the most-connected teammate for this entry (build-plan.md Minimum tier: "flag the one most-connected teammate")
    user_id: number;
    // one plain-English sentence, written for the person reading their own feed
    reason: string;
    // 0..1, TeammateScore.score — rendered nowhere, kept so the real response maps 1:1
    score: number;
}

// null = nobody on the team has touched these files; the UI renders that as a sentence, not blank
export async function getRelevance(incidentId: number, entryId: number): Promise<RelevanceLine | null> {
    return fixtureRelevance(incidentId, entryId);
}
