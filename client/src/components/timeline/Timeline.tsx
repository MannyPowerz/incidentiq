import { useRef } from 'react';
import type { JSX } from 'react';
import { readAiDraftBody } from '../../api';
import type { ClientPostableType, RelevanceLine, TimelineEntry } from '../../api';
import type { RelevanceById } from '../../hooks/useRelevance';
import { Badge, Button, EmptyState, LiveDot } from '../ui';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import './Timeline.css';

type TimelineProps = {
    // expected id-ascending (mergeEntries); rendered in the order given, never re-sorted by time
    entries: TimelineEntry[];
    currentUserId: number | null;
    // both present means unconfirmed drafts get Confirm / Reject; absent means the timeline is read-only
    onConfirmDraft?: (entry: TimelineEntry) => void;
    onRejectDraft?: (entry: TimelineEntry) => void;
    // the draft with a request in flight, so its two buttons can't both fire
    busyEntryId?: number | null;
    // the most-connected teammate per entry; an entry missing from the map shows no line yet
    relevance?: RelevanceById;
    // your own post while the server has not confirmed it yet: shown, labeled, and never mixed into entries
    pending?: PendingEntry | null;
};

export type PendingEntry = { type: ClientPostableType; text: string };

// an ai_draft nobody has vouched for: author_id stays null until a human confirms it (ADR 0014)
export const isPendingDraft = (entry: TimelineEntry): boolean => entry.type === 'ai_draft' && entry.author_id === null;

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

export default function Timeline({
    entries,
    currentUserId,
    onConfirmDraft,
    onRejectDraft,
    busyEntryId = null,
    relevance,
    pending = null,
}: TimelineProps): JSX.Element {
    // the highest id present when the timeline first rendered; only entries after it animate in,
    // so opening a room is calm and only what arrives while you watch moves
    const loadedUpTo = useRef(entries.at(-1)?.id ?? 0);

    if (entries.length === 0 && !pending) {
        return <EmptyState title="No entries yet" body="Post what you've seen or tried, so the next person starts from there." />;
    }

    return (
        <ol className="timeline" aria-label="Timeline">
            {entries.map((entry) => {
                const draftPending = isPendingDraft(entry);
                const busy = busyEntryId === entry.id;
                const arrived = entry.id > loadedUpTo.current;
                // a teammate's (or the AI's) arrival is news; your own post only slides in
                const incoming = arrived && entry.author_id !== currentUserId;
                const classes = [
                    'timeline__entry',
                    `timeline__entry--${entry.type}`,
                    draftPending && 'timeline__entry--pending',
                    arrived && 'timeline__entry--new',
                    incoming && 'timeline__entry--incoming',
                ].filter(Boolean).join(' ');
                return (
                <li key={entry.id} className={classes} data-spotlight>
                    <header className="timeline__meta">
                        <Badge tone="entry" value={entry.type} />
                        <span className="timeline__author">{authorLabel(entry, currentUserId)}</span>
                        <time className="timeline__time" dateTime={entry.created_at} title={new Date(entry.created_at).toLocaleString()}>
                            {formatRelativeTime(entry.created_at)}
                        </time>
                    </header>
                    <EntryBody entry={entry} />
                    {relevance?.has(entry.id) && (
                        <RelevanceNote line={relevance.get(entry.id) ?? null} currentUserId={currentUserId} />
                    )}
                    {draftPending && onConfirmDraft && onRejectDraft && (
                        <footer className="timeline__actions">
                            <Button
                                size="sm"
                                loading={busy}
                                disabled={busyEntryId !== null}
                                aria-label={`Confirm AI draft ${entry.id}`}
                                onClick={() => onConfirmDraft(entry)}
                            >
                                Confirm
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyEntryId !== null}
                                aria-label={`Reject AI draft ${entry.id}`}
                                onClick={() => onRejectDraft(entry)}
                            >
                                Reject
                            </Button>
                            <span className="timeline__actions-note">Confirming puts your name on it. Rejecting deletes it.</span>
                        </footer>
                    )}
                </li>
                );
            })}
            {pending && (
                // newest by definition: the server will give it the highest id, so it sits last (ADR 0001)
                <li className={`timeline__entry timeline__entry--${pending.type} timeline__entry--sending`} aria-busy="true">
                    <header className="timeline__meta">
                        <Badge tone="entry" value={pending.type} />
                        <span className="timeline__author">You</span>
                        <LiveDot state="syncing" label="Sending" />
                    </header>
                    <p className="timeline__body">{pending.text}</p>
                </li>
            )}
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

/**
 * "Who should look at this", written for the person reading (server/src/relevance/types.ts ReasonFor).
 * Tagged "sample" because the line comes from a fixture until the relevance endpoint ships; an
 * untagged invented "ask User #2" in a demo would read as a real claim about a real teammate.
 */
export function RelevanceNote({ line, currentUserId }: { line: RelevanceLine | null; currentUserId: number | null }): JSX.Element {
    let text: string;
    if (line === null) text = 'Nobody on the team has touched these files yet.';
    else if (line.user_id === currentUserId) text = `You're closest to this: ${line.reason}`;
    else text = `Ask User #${line.user_id}: ${line.reason}`;
    return (
        <p className="timeline__relevance">
            <span className="timeline__relevance-text">{text}</span>
            <span className="timeline__relevance-tag" title="Sample data until the relevance endpoint ships">
                sample
            </span>
        </p>
    );
}
