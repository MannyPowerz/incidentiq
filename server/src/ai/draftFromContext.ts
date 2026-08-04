/**
 * draftFromContext.ts — incident context in, a validated AiDraft out, or a typed throw.
 *
 * Structured output shapes the draft; the exit check enforces content (non-empty), which the
 * provider never promised. Both deliberately — ADR 0006. Fail-fast, no retry — ADR 0007.
 * Provider is Gemini via env config — ADR 0009.
 *
 * The delivery half builds against this signature and the error types in ./types.js.
 */

import type { AiDraftRequest, AiDraft } from './types.js';
import { aiDraftSchema, AiDraftProviderError, AiDraftValidationError } from './types.js';
import { buildPrompt } from './prompt.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import 'dotenv/config'

export async function draftFromContext(input: AiDraftRequest): Promise<AiDraft> {

    // checked, not asserted with `!` — an unset model name fails deep in the Google SDK with an opaque error
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

    // only the provider call is in the try — a schema failure below must not be reported as a provider failure
    try {
        raw = await structuredModel.invoke(messages);
    } 
    
    catch (err) {
        throw new AiDraftProviderError(
            `AI provider call failed for incident ${input.incidentId}`,
            { cause: err },
        );
    }

    // safeParse, not parse — a raw ZodError escaping would leak zod into the delivery half's error handling
    const result = aiDraftSchema.safeParse(raw);

    if (!result.success) {
        throw new AiDraftValidationError(
            `AI returned a draft that failed aiDraftSchema for incident ${input.incidentId}`,
            { cause: result.error },
        );
    }

    return result.data;
}
