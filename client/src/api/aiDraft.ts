// aiDraft.ts — real. server/src/ai/routes/create.ts. Needs AI_MODEL_NAME and a provider key on the
// server; without them the server answers 504 upstream_error.

import { jsonInit, request } from './client';
import type { AiDraftBody, TimelineEntry } from './types';

export type AiDraftInput = {
    // a pasted log or scanner output; must be non-empty (ai/types.ts aiDraftRequestSchema)
    context: string;
    kind?: 'log' | 'scanner';
};

// bare ai_draft entry with author_id null — it is not anyone's until confirmed
export function requestAiDraft(incidentId: number, input: AiDraftInput): Promise<TimelineEntry> {
    return request<TimelineEntry>(`/incidents/${incidentId}/ai-draft`, jsonInit('POST', input));
}

// body is untyped JSONB, so a screen reads a draft through this rather than casting and hoping
export function readAiDraftBody(entry: TimelineEntry): AiDraftBody | null {
    if (entry.type !== 'ai_draft') return null;
    const { summary, why_it_matters, likely_fix } = entry.body;
    if (typeof summary !== 'string' || typeof why_it_matters !== 'string' || typeof likely_fix !== 'string') return null;
    return { summary, why_it_matters, likely_fix };
}
