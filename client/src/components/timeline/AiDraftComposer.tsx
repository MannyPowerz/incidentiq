import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { ApiError, NETWORK_ERROR, requestAiDraft } from '../../api';
import type { TimelineEntry } from '../../api';
import { Button, Select, Textarea } from '../ui';
import './AiDraftComposer.css';

type AiDraftComposerProps = {
    incidentId: number;
    // receives the stored draft from the POST response; the page merges it by id, so the socket echo is a no-op
    onDrafted: (entry: TimelineEntry) => void;
};

type Kind = 'log' | 'scanner';

const KIND_LABEL: Record<Kind, string> = {
    log: 'A log or error output',
    scanner: 'Scanner output',
};

/**
 * What a screen says for each way the draft route can fail (server/src/ai/routes/create.ts).
 * The server's own messages are for developers ("Difficulty in responsiveness to the server"), so
 * the code picks the sentence and the message is only the fallback.
 */
export function draftErrorMessage(error: unknown): string {
    if (!(error instanceof ApiError)) return 'Could not request a draft. Try again.';
    if (error.code === NETWORK_ERROR) return error.message;
    if (error.code === 'upstream_error') return "The AI provider didn't answer. Try again in a moment.";
    if (error.code === 'invalid_schema_structure') return 'The AI answered with something unusable. Try again, or paste more of the output.';
    if (error.code === 'AiDraftProviderError') return "The AI service isn't set up on this server yet.";
    if (error.code === 'incident_not_found') return 'This room no longer exists.';
    return error.message;
}

/**
 * Pasted log or scanner output in, one ai_draft entry out. The draft is unconfirmed and has no
 * author: it sits in the timeline until a human confirms or rejects it (ADR 0014). Nothing here
 * posts anything on its own.
 */
export default function AiDraftComposer({ incidentId, onDrafted }: AiDraftComposerProps): JSX.Element {
    const [context, setContext] = useState('');
    const [kind, setKind] = useState<Kind>('log');
    const [error, setError] = useState<string | null>(null);
    const [drafting, setDrafting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = context.trim();
        if (!trimmed) {
            setError('Paste a log or scanner output first');
            return;
        }
        setDrafting(true);
        setError(null);
        try {
            onDrafted(await requestAiDraft(incidentId, { context: trimmed, kind }));
            // only a successful draft clears the paste: a failure keeps it so a retry is one click
            setContext('');
        } catch (err) {
            setError(draftErrorMessage(err));
        } finally {
            setDrafting(false);
        }
    }

    return (
        <form className="ai-draft-composer" onSubmit={handleSubmit} noValidate>
            <Select
                className="ai-draft-composer__kind"
                label="What are you pasting?"
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                options={(Object.keys(KIND_LABEL) as Kind[]).map((value) => ({ value, label: KIND_LABEL[value] }))}
            />
            <Textarea
                label="Output to explain"
                mono
                rows={6}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Paste the log lines or scanner result here"
                // a real draft takes 10 to 20 seconds, and a spinner alone reads as stuck
                hint={drafting ? 'Drafting. This usually takes 10 to 20 seconds.' : 'The AI drafts a summary and a likely fix. Nothing is posted until you confirm it.'}
                error={error ?? undefined}
            />
            <div className="ai-draft-composer__actions">
                <Button type="submit" variant="secondary" loading={drafting}>
                    Draft from context
                </Button>
            </div>
        </form>
    );
}
