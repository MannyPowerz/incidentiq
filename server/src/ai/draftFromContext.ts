/**
 * draftFromContext.ts — the "produce the draft" half (Anthony's lane).
 *
 * Right now this is a STUB: it returns a hardcoded valid AiDraft so the "deliver the draft" half
 * (the route + write-to-timeline) can be built and tested against the real contract TODAY, without
 * waiting on the AI. That's what makes the two halves parallel.
 *
 * Anthony's job: replace the body below with the real LangChain call (prompt -> LLM -> parse), then
 * validate the model's output with aiDraftSchema.parse(...) before returning it — never trust raw
 * LLM JSON. Keep the signature and return type EXACTLY as-is; that's the contract the other half
 * depends on.
 */

import type { AiDraftRequest, AiDraft } from './types.js';

export async function draftFromContext(input: AiDraftRequest): Promise<AiDraft> {
    // TODO(Anthony): replace this stub with the real LangChain implementation.
    return {
        summary: `[stub] draft for incident ${input.incidentId}`,
        why_it_matters: '[stub] why this matters',
        likely_fix: '[stub] the likely fix',
    };
}
