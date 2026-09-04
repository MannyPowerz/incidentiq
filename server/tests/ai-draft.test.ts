/**
 * ai-draft.test.ts — draftFromContext, with the provider mocked at the module boundary.
 *
 * Mocked because the failures worth testing (an empty-but-well-shaped draft, a provider that
 * throws) can't be produced on demand against a live model.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// hoisted so the vi.mock factory below (which vitest lifts above the imports) can close over it
const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@langchain/google-genai', () => ({
    ChatGoogleGenerativeAI: class {
        withStructuredOutput() {
            return { invoke: invokeMock };
        }
    },
}));

import { draftFromContext } from '../src/ai/draftFromContext.js';
import { AiDraftProviderError, AiDraftValidationError } from '../src/ai/types.js';
import type { AiDraftRequest } from '../src/ai/types.js';

const request: AiDraftRequest = {
    incidentId: 1,
    context: 'TypeError: Cannot read properties of undefined (reading "id")',
    kind: 'log',
};

describe('draftFromContext', () => {
    beforeEach(() => {
        invokeMock.mockReset();
        vi.stubEnv('AI_MODEL_NAME', 'gemini-2.5-flash');
    });

    it('returns the draft when the model answers with a valid one', async () => {
        const draft = {
            summary: 'Undefined object dereference in request handler',
            why_it_matters: 'Every request on this path 500s until it is fixed.',
            likely_fix: 'Guard the lookup before reading .id, or fix the upstream query.',
        };
        invokeMock.mockResolvedValue(draft);

        await expect(draftFromContext(request)).resolves.toEqual(draft);
    });

    // the case structured output can't catch — right keys, right types, empty content.
    // Only .min(1) rejects it, so this failing means the exit gate stopped doing anything.
    it('throws AiDraftValidationError when a field is well-shaped but empty', async () => {
        invokeMock.mockResolvedValue({
            summary: '',
            why_it_matters: 'something',
            likely_fix: 'something',
        });

        await expect(draftFromContext(request)).rejects.toThrow(AiDraftValidationError);
    });

    it('throws AiDraftValidationError when the model drops a required field', async () => {
        invokeMock.mockResolvedValue({ summary: 'only this one' });

        await expect(draftFromContext(request)).rejects.toThrow(AiDraftValidationError);
    });

    it('throws AiDraftProviderError when the provider call itself fails', async () => {
        invokeMock.mockRejectedValue(new Error('429 rate limit exceeded'));

        await expect(draftFromContext(request)).rejects.toThrow(AiDraftProviderError);
    });

    // the split is the whole reason the delivery route can map these to different statuses
    it('does not report a provider failure as a validation failure', async () => {
        invokeMock.mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(draftFromContext(request)).rejects.not.toThrow(AiDraftValidationError);
    });

    it('keeps the original failure on .cause for logging', async () => {
        const underlying = new Error('503 service unavailable');
        invokeMock.mockRejectedValue(underlying);

        await expect(draftFromContext(request)).rejects.toMatchObject({ cause: underlying });
    });

    it('names the missing env var instead of failing inside the SDK', async () => {
        vi.stubEnv('AI_MODEL_NAME', '');

        await expect(draftFromContext(request)).rejects.toThrow(/AI_MODEL_NAME/);
    });
});
