import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, confirmAiDraft, getIncident, listTimeline, mergeEntries, rejectAiDraft, resolveIncident } from '../api';
import type { Incident, TimelineEntry } from '../api';
import { getCurrentUserId } from '../auth/tokenStore';
import { Badge, Button, Card, EmptyState, ErrorState, LiveDot, Spinner, useToast } from '../components/ui';
import type { LiveState } from '../components/ui';
import { useRoomLive } from '../hooks/useRoomLive';
import type { EntriesUpdate } from '../hooks/useRoomLive';
import { useRelevance } from '../hooks/useRelevance';
import Timeline from '../components/timeline/Timeline';
import type { PendingEntry } from '../components/timeline/Timeline';
import EntryComposer from '../components/timeline/EntryComposer';
import AiDraftComposer from '../components/timeline/AiDraftComposer';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import './RoomDetailsPage.css';

const LIVE_LABEL: Record<LiveState, string> = {
    idle: 'Offline',
    syncing: 'Connecting',
    live: 'Live',
    failing: 'Disconnected',
};

type LoadState =
    | { status: 'loading' }
    | { status: 'not-found' }
    | { status: 'error'; message: string }
    | { status: 'ready'; incident: Incident; entries: TimelineEntry[] };

/**
 * RoomDetailsPage — one incident: its header, its timeline (oldest first, by entry id — ADR 0001),
 * and the forms to add to it. Every change shown here comes from a stored row the server returned,
 * whether from an HTTP response or a socket broadcast; both merge through mergeEntries.
 * AI drafts arrive unconfirmed. A human confirming one is what gives it an author (ADR 0014).
 */
export default function RoomDetailsPage(): JSX.Element {
    const { roomId } = useParams<{ roomId: string }>();
    const id = Number(roomId);
    const validId = Number.isInteger(id) && id > 0;

    const [state, setState] = useState<LoadState>(validId ? { status: 'loading' } : { status: 'not-found' });
    const [attempt, setAttempt] = useState(0);
    const [resolving, setResolving] = useState(false);
    // the one draft with a confirm or reject in flight; its sibling buttons wait too
    const [busyEntryId, setBusyEntryId] = useState<number | null>(null);
    // your post while it is in flight; shown in the timeline as provisional, never stored in entries
    const [sending, setSending] = useState<PendingEntry | null>(null);
    const toast = useToast();
    const currentUserId = getCurrentUserId();

    // hands socket arrivals to the same entries the HTTP load filled; a no-op until the room has loaded
    const applyLive = useCallback((update: EntriesUpdate) => {
        setState((s) => (s.status === 'ready' ? { ...s, entries: update(s.entries) } : s));
    }, []);
    const ready = state.status === 'ready';
    const live = useRoomLive({
        // joins only once the room is known to exist, so a 404 never opens a socket
        incidentId: ready ? id : null,
        lastSeenId: ready ? state.entries.at(-1)?.id ?? 0 : 0,
        currentUserId,
        apply: applyLive,
    });
    // fixture-backed until the relevance endpoint ships; only asks about entries it has not seen
    const relevance = useRelevance(ready ? id : null, ready ? state.entries.map((e) => e.id) : []);

    useEffect(() => {
        if (!validId) return;
        let cancelled = false;
        Promise.all([getIncident(id), listTimeline(id)]).then(
            ([incident, entries]) => !cancelled && setState({ status: 'ready', incident, entries: mergeEntries([], entries) }),
            (error) => {
                if (cancelled) return;
                // the server answers 404 for another org's room too, so "not found" never leaks that it exists
                if (error instanceof ApiError && error.status === 404) setState({ status: 'not-found' });
                else setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Something went wrong.' });
            },
        );
        return () => {
            cancelled = true;
        };
    }, [id, validId, attempt]);

    function retry() {
        setState({ status: 'loading' });
        setAttempt((n) => n + 1);
    }

    function handlePosted(entry: TimelineEntry) {
        setState((s) => (s.status === 'ready' ? { ...s, entries: mergeEntries(s.entries, [entry]) } : s));
    }

    // these four mean the draft is no longer what this screen thinks it is: someone confirmed it,
    // someone rejected it, or it changed between the server's check and its write
    const DRAFT_RACE_CODES = ['already_approved', 'entry_state_changed', 'entry_not_found', 'not_ai_draft'];

    async function handleDraftAction(entry: TimelineEntry, action: 'confirm' | 'reject') {
        setBusyEntryId(entry.id);
        try {
            if (action === 'confirm') {
                // the response is the stored row with author_id set; the socket echo merges to the same entry
                const confirmed = await confirmAiDraft(id, entry.id);
                setState((s) => (s.status === 'ready' ? { ...s, entries: mergeEntries(s.entries, [confirmed]) } : s));
                toast.show('success', 'Draft confirmed. It is now under your name.');
            } else {
                const rejected = await rejectAiDraft(id, entry.id);
                setState((s) => (s.status === 'ready' ? { ...s, entries: s.entries.filter((e) => e.id !== rejected.id) } : s));
                toast.show('success', 'Draft rejected and deleted.');
            }
        } catch (error) {
            if (error instanceof ApiError && DRAFT_RACE_CODES.includes(error.code)) {
                toast.show('info', 'Someone already handled this draft. Showing the latest timeline.');
                await refreshTimeline();
            } else {
                toast.show('error', error instanceof ApiError ? error.message : 'Could not update the draft.');
            }
        } finally {
            setBusyEntryId(null);
        }
    }

    // replaces rather than merges: a rejected draft is deleted, and a merge would keep it on screen
    async function refreshTimeline() {
        try {
            const fresh = await listTimeline(id);
            setState((s) => (s.status === 'ready' ? { ...s, entries: mergeEntries([], fresh) } : s));
        } catch {
            toast.show('error', "Couldn't refresh the timeline. Reload the page.");
        }
    }

    async function handleResolve() {
        setResolving(true);
        try {
            const incident = await resolveIncident(id);
            setState((s) => (s.status === 'ready' ? { ...s, incident } : s));
            toast.show('success', 'Room resolved');
        } catch (error) {
            toast.show('error', error instanceof ApiError ? error.message : 'Could not resolve the room.');
        } finally {
            setResolving(false);
        }
    }

    if (state.status === 'loading') {
        return (
            <div className="room-page__loading">
                <Spinner label="Loading room" />
            </div>
        );
    }

    if (state.status === 'not-found') {
        return (
            <EmptyState
                title="Room not found"
                body="It may have been removed, or it belongs to another organization."
                action={
                    <Link className="room-page__back-button" to="/rooms">
                        Back to rooms
                    </Link>
                }
            />
        );
    }

    if (state.status === 'error') {
        return <ErrorState title="Couldn't load this room" body={state.message} retry={retry} />;
    }

    const { incident, entries } = state;
    const finished = incident.status === 'resolved' || incident.status === 'postmortem';

    return (
        <div className="room-page">
            <Link className="room-page__back" to="/rooms">
                ← Rooms
            </Link>

            <header className="room-page__header">
                <div className="room-page__heading">
                    <div className="room-page__badges">
                        <Badge tone="severity" value={incident.severity} />
                        <Badge tone="status" value={incident.status} />
                        <span className="room-page__id">#{incident.id}</span>
                        <LiveDot state={live.state} label={LIVE_LABEL[live.state]} />
                    </div>
                    <h1 className="room-page__title">{incident.title}</h1>
                    <dl className="room-page__facts">
                        <div>
                            <dt>System</dt>
                            <dd className="room-page__mono">{incident.affected_system ?? '—'}</dd>
                        </div>
                        <div>
                            <dt>Opened</dt>
                            <dd>
                                <time dateTime={incident.created_at}>{formatRelativeTime(incident.created_at)}</time>
                            </dd>
                        </div>
                        {incident.resolved_at && (
                            <div>
                                <dt>Resolved</dt>
                                <dd>
                                    <time dateTime={incident.resolved_at}>{formatRelativeTime(incident.resolved_at)}</time>
                                </dd>
                            </div>
                        )}
                        <div>
                            <dt>Entries</dt>
                            <dd className="room-page__mono">{entries.length}</dd>
                        </div>
                    </dl>
                </div>
                {!finished && (
                    <Button variant="secondary" loading={resolving} onClick={handleResolve}>
                        Mark resolved
                    </Button>
                )}
            </header>

            <section className="room-page__timeline" aria-labelledby="timeline-heading">
                <h2 id="timeline-heading" className="room-page__section-title">
                    Timeline
                </h2>
                <Timeline
                    entries={entries}
                    currentUserId={currentUserId}
                    busyEntryId={busyEntryId}
                    onConfirmDraft={(entry) => handleDraftAction(entry, 'confirm')}
                    onRejectDraft={(entry) => handleDraftAction(entry, 'reject')}
                    relevance={relevance}
                    pending={sending}
                />
                {/* one polite region for arrivals: announced once each, never a focus steal (design-system.md §4.6) */}
                <p className="ui-sr-only" aria-live="polite">
                    {live.announcement}
                </p>
            </section>

            <Card title="Add to the timeline">
                <EntryComposer incidentId={incident.id} onPosted={handlePosted} onSendingChange={setSending} />
            </Card>

            <Card title="Draft with AI">
                <AiDraftComposer incidentId={incident.id} onDrafted={handlePosted} />
            </Card>
        </div>
    );
}
