import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, getIncident, listTimeline, mergeEntries, resolveIncident } from '../api';
import type { Incident, TimelineEntry } from '../api';
import { getCurrentUserId } from '../auth/tokenStore';
import { Badge, Button, Card, EmptyState, ErrorState, Spinner, useToast } from '../components/ui';
import Timeline from '../components/timeline/Timeline';
import EntryComposer from '../components/timeline/EntryComposer';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import './RoomDetailsPage.css';

type LoadState =
    | { status: 'loading' }
    | { status: 'not-found' }
    | { status: 'error'; message: string }
    | { status: 'ready'; incident: Incident; entries: TimelineEntry[] };

/**
 * RoomDetailsPage — one incident: its header, its timeline (oldest first, by entry id — ADR 0001),
 * and the form to add to it. Every change shown here comes from a stored row the server returned;
 * Item 4 adds the socket, which merges into the same entries array through the same mergeEntries.
 */
export default function RoomDetailsPage(): JSX.Element {
    const { roomId } = useParams<{ roomId: string }>();
    const id = Number(roomId);
    const validId = Number.isInteger(id) && id > 0;

    const [state, setState] = useState<LoadState>(validId ? { status: 'loading' } : { status: 'not-found' });
    const [attempt, setAttempt] = useState(0);
    const [resolving, setResolving] = useState(false);
    const toast = useToast();

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
                <Timeline entries={entries} currentUserId={getCurrentUserId()} />
            </section>

            <Card title="Add to the timeline">
                <EntryComposer incidentId={incident.id} onPosted={handlePosted} />
            </Card>
        </div>
    );
}
