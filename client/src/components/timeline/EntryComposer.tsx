import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { ApiError, CLIENT_POSTABLE_TYPES, postTimelineEntry } from '../../api';
import type { ClientPostableType, TimelineEntry } from '../../api';
import { Button, Select, Textarea } from '../ui';
import './EntryComposer.css';

type EntryComposerProps = {
    incidentId: number;
    // receives the stored row from the POST response — the page merges it by id, never appends
    onPosted: (entry: TimelineEntry) => void;
};

const TYPE_LABEL: Record<ClientPostableType, string> = {
    observation: 'Observation — something I saw',
    action: 'Action — something I did',
    finding: 'Finding — something I learned',
};

export default function EntryComposer({ incidentId, onPosted }: EntryComposerProps): JSX.Element {
    const [type, setType] = useState<ClientPostableType>('observation');
    const [text, setText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [posting, setPosting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = text.trim();
        if (!trimmed) {
            setError('Write something first');
            return;
        }
        setPosting(true);
        setError(null);
        try {
            onPosted(await postTimelineEntry(incidentId, { type, body: { text: trimmed } }));
            setText('');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not post. Try again.');
        } finally {
            setPosting(false);
        }
    }

    return (
        <form className="entry-composer" onSubmit={handleSubmit} noValidate>
            <Select
                className="entry-composer__type"
                label="Entry type"
                value={type}
                onChange={(e) => setType(e.target.value as ClientPostableType)}
                options={CLIENT_POSTABLE_TYPES.map((value) => ({ value, label: TYPE_LABEL[value] }))}
            />
            <Textarea
                label="What happened?"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="VPN reconnects every 4 minutes on the office network, not on hotspot"
                error={error ?? undefined}
            />
            <div className="entry-composer__actions">
                <Button type="submit" loading={posting}>
                    Post to timeline
                </Button>
            </div>
        </form>
    );
}
