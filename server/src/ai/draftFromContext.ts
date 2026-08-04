/**
 * draftFromContext.ts — the "produce the draft" half of the AI service: incident context in,
 * a validated AiDraft out, or a typed throw.
 *
 * Approach: structured output (withStructuredOutput bound to aiDraftSchema) composed with an
 * explicit schema check at the exit, per ADR 0006.
 *   ↳ vs. structured output alone — rejected: it guarantees the draft's SHAPE at the provider
 *     level, but not its content; an empty-string summary is still a well-shaped object, and
 *     only aiDraftSchema's .min(1) catches it. The exit check is the boundary WE own.
 *   ↳ vs. prompt-and-parse (ask for JSON, JSON.parse it) — rejected as default: the model can
 *     wrap JSON in prose or fences, pushing repair logic onto us. Kept as the fallback if a
 *     future provider lacks structured output, which is why buildPrompt stays separable.
 * Fail-fast on error, no retry — deferred deliberately, with its revisit trigger, in ADR 0007.
 *
 * Role: this is the contract the delivery half (route + write-to-timeline, feat/ai-delivery)
 * builds against. Signature and return type are frozen; failures travel as the two error types
 * exported from ./types.js. Provider is Gemini per ADR 0009, reached via env config only.
 */

import type { AiDraftRequest, AiDraft } from './types.js';
import { aiDraftSchema, AiDraftProviderError, AiDraftValidationError } from './types.js';
import { buildPrompt } from './prompt.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import 'dotenv/config'

export async function draftFromContext(input: AiDraftRequest): Promise<AiDraft> {

    // checked here rather than asserted with `!`: an undefined model name fails deep inside the
    // -> Google SDK with an opaque error, and this says which env var is missing. Same reason
    // -> globalSetup.ts checks TEST_DATABASE_URL by hand instead of letting pg fail on it.
    const modelName = process.env.AI_MODEL_NAME;

    if (!modelName) {
        throw new Error('AI_MODEL_NAME is not set — copy .env.example to .env and set a Gemini model id');
    }

    const model = new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: process.env.GOOGLE_API_KEY,
    });

    const structuredModel = model.withStructuredOutput(aiDraftSchema);

    const messages = buildPrompt(input);

    let raw: unknown;

    // only the provider call is inside the try — a schema failure below must not be
    // -> swallowed here and mislabelled as a provider failure.
    try {
        raw = await structuredModel.invoke(messages);
    } 
    
    catch (err) {
        throw new AiDraftProviderError(
            `AI provider call failed for incident ${input.incidentId}`,
            { cause: err },
        );
    }

    // safeParse, not parse: a raw ZodError escaping here would leak zod into the delivery
    // -> half's error handling instead of the two contract types it imports from types.ts.
    const result = aiDraftSchema.safeParse(raw);

    if (!result.success) {
        throw new AiDraftValidationError(
            `AI returned a draft that failed aiDraftSchema for incident ${input.incidentId}`,
            { cause: result.error },
        );
    }

    return result.data;
}
