import type { JSX } from 'react';
import { readAiDraftBody } from '../../api';
import type { TimelineEntry } from '../../api';
import { Badge, EmptyState } from '../ui';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import './Timeline.css';

type TimelineProps = {
    // expected id-ascending (mergeEntries); rendered in the order given, never re-sorted by time
    entries: TimelineEntry[];
    currentUserId: number | null;
};

// author_id is accountability, not authorship (server/src/timeline/types.ts); null means no human owns it yet
export function authorLabel(entry: TimelineEntry, currentUserId: number | null): string {
    if (entry.author_id === null) return entry.type === 'system' ? 'System' : 'Awaiting confirmation';
    if (entry.author_id === currentUserId) return 'You';
    // no GET /users yet, so a teammate is their id until the server can name them (ui-roadmap.md Item 3)
    return `User #${entry.author_id}`;
}

/**
 * Human entries have no designed body yet (a generic object server-side); this client posts { text }.
 * Anything else, such as a body the agent wrote, falls back to its JSON so nothing is silently hidden.
 */
export function entryText(entry: TimelineEntry): string {
    const { text } = entry.body;
    return typeof text === 'string' ? text : JSON.stringify(entry.body, null, 2);
}

export default function Timeline({ entries, currentUserId }: TimelineProps): JSX.Element {
    if (entries.length === 0) {
        return <EmptyState title="No entries yet" body="Post what you've seen or tried, so the next person starts from there." />;
    }

    return (
        <ol className="timeline" aria-label="Timeline">
            {entries.map((entry) => (
                <li key={entry.id} className={`timeline__entry timeline__entry--${entry.type}`}>
                    <header className="timeline__meta">
                        <Badge tone="entry" value={entry.type} />
                        <span className="timeline__author">{authorLabel(entry, currentUserId)}</span>
                        <time className="timeline__time" dateTime={entry.created_at} title={new Date(entry.created_at).toLocaleString()}>
                            {formatRelativeTime(entry.created_at)}
                        </time>
                    </header>
                    <EntryBody entry={entry} />
                </li>
            ))}
        </ol>
    );
}

function EntryBody({ entry }: { entry: TimelineEntry }): JSX.Element {
    const draft = readAiDraftBody(entry);
    if (draft) {
        return (
            <dl className="timeline__draft">
                <dt>Summary</dt>
                <dd>{draft.summary}</dd>
                <dt>Why it matters</dt>
                <dd>{draft.why_it_matters}</dd>
                <dt>Likely fix</dt>
                <dd>{draft.likely_fix}</dd>
            </dl>
        );
    }
    const text = entryText(entry);
    const isJson = typeof entry.body.text !== 'string';
    return <p className={`timeline__body${isJson ? ' timeline__body--raw' : ''}`}>{text}</p>;
}
