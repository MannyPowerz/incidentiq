/**
 * types.ts — the AI Service (core) contract, in code. This is the shared seam that lets the two
 * halves of the work run in parallel: the "produce the draft" half (draftFromContext) and the
 * "deliver the draft" half (route + write-to-timeline) both depend only on the shapes here.
 *
 * Human doc version lives in docs/contracts.md. If the team changes the shape, change it in ONE
 * place (here), and both halves move together.
 */

import { z } from 'zod';

// INPUT — what the server hands the AI. context is free text (a pasted log or scanner output);
// kind tells the AI how to read it.
export const aiDraftRequestSchema = z.object({
    incidentId: z.number(),
    context: z.string().min(1),
    kind: z.enum(['log', 'scanner']).default('log'),
});
export type AiDraftRequest = z.infer<typeof aiDraftRequestSchema>;

// OUTPUT — the structured draft. This object becomes the body of an ai_draft timeline entry once
// a human confirms it. The server validates the AI's output against this before trusting it.
export const aiDraftSchema = z.object({
    summary: z.string().min(1),
    why_it_matters: z.string().min(1),
    likely_fix: z.string().min(1),
});

export type AiDraft = z.infer<typeof aiDraftSchema>;
