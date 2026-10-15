import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, listIncidents } from '../api';
import type { Incident } from '../api';
import { Badge, Button, EmptyState, ErrorState, LiveDot, Select, useToast } from '../components/ui';
import CreateRoomModal from '../components/rooms/CreateRoomModal';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import './RoomsPage.css';

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; incidents: Incident[] };

const SEVERITIES = ['P1', 'P2', 'P3', 'P4'] as const;
// open P1s shown as cards up top; any beyond this lead the open list instead, so the top never becomes a wall
export const ATTENTION_CARDS = 6;

// resolved and postmortem rooms are finished; everything else still needs someone
const isOpen = (incident: Incident) => incident.status !== 'resolved' && incident.status !== 'postmortem';
// most severe first, then newest; P1 < P2 as strings, and a higher id is a newer room
const bySeverityThenNewest = (a: Incident, b: Incident) => a.severity.localeCompare(b.severity) || b.id - a.id;

/**
 * RoomsPage — a triage board for every incident in the caller's org. It is built around the one
 * decision this page exists for, "which room needs me now": open P1s as cards on top, the rest of
 * the open rooms by severity, and finished rooms folded away. Severity chips and a system filter
 * narrow all three at once, on the client, because the org's list is already loaded.
 *
 * A created room is prepended locally from the POST response rather than refetched: the response is
 * the stored row, so the board never shows data the database doesn't have.
 */
export default function RoomsPage(): JSX.Element {
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [creating, setCreating] = useState(false);
    const [severity, setSeverity] = useState<string | null>(null);
    const [system, setSystem] = useState<string>('');
    const toast = useToast();

    useEffect(() => {
        // a retry or unmount mid-request must not let the older response overwrite the newer state
        let cancelled = false;
        listIncidents().then(
            (incidents) => !cancelled && setState({ status: 'ready', incidents }),
            (error) =>
                !cancelled &&
                setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Something went wrong.' }),
        );
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    function retry() {
        setState({ status: 'loading' });
        setAttempt((n) => n + 1);
    }

    function handleCreated(incident: Incident) {
        setState((current) =>
            current.status === 'ready' ? { status: 'ready', incidents: [incident, ...current.incidents] } : current,
        );
        setCreating(false);
        toast.show('success', `Room "${incident.title}" created`);
    }

    const all = state.status === 'ready' ? state.incidents : [];
    const open = all.filter(isOpen);
    const systems = [...new Set(all.map((i) => i.affected_system).filter((s): s is string => Boolean(s)))].sort();

    // the filters narrow every group at once; the chip counts ignore the severity filter so you can see where to go next
    const bySystem = all.filter((i) => !system || i.affected_system === system);
    const shown = bySystem.filter((i) => !severity || i.severity === severity);
    const shownOpen = shown.filter(isOpen).sort(bySeverityThenNewest);
    const attention = shownOpen.filter((i) => i.severity === 'P1').slice(0, ATTENTION_CARDS);
    const rest = shownOpen.filter((i) => !attention.includes(i));
    const finished = shown.filter((i) => !isOpen(i));
    const filtering = severity !== null || system !== '';

    return (
        <div className="rooms-page">
            <header className="rooms-page__header">
                <div>
                    <h1 className="rooms-page__title">Rooms</h1>
                    {state.status === 'ready' && all.length > 0 && (
                        <p className="rooms-page__summary" aria-label="Summary">
                            <strong>{open.length}</strong> open, <strong>{open.filter((i) => i.severity === 'P1').length}</strong> at P1,{' '}
                            <strong>{all.length - open.length}</strong> resolved
                        </p>
                    )}
                </div>
                <Button onClick={() => setCreating(true)}>New room</Button>
            </header>

            {state.status === 'ready' && all.length > 0 && (
                <div className="rooms-page__filters" role="group" aria-label="Filter rooms">
                    <div className="rooms-page__chips">
                        <button type="button" className="rooms-chip" aria-pressed={severity === null} onClick={() => setSeverity(null)}>
                            All <span className="rooms-chip__count">{bySystem.length}</span>
                        </button>
                        {SEVERITIES.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={`rooms-chip rooms-chip--${s.toLowerCase()}`}
                                aria-pressed={severity === s}
                                onClick={() => setSeverity((current) => (current === s ? null : s))}
                            >
                                {s} <span className="rooms-chip__count">{bySystem.filter((i) => i.severity === s).length}</span>
                            </button>
                        ))}
                    </div>
                    {systems.length > 1 && (
                        <Select
                            className="rooms-page__system"
                            label="System"
                            value={system}
                            onChange={(e) => setSystem(e.target.value)}
                            options={[{ value: '', label: 'All systems' }, ...systems.map((s) => ({ value: s, label: s }))]}
                        />
                    )}
                </div>
            )}

            {state.status === 'loading' && <RoomsSkeleton />}

            {state.status === 'error' && <ErrorState title="Couldn't load rooms" body={state.message} retry={retry} />}

            {state.status === 'ready' && all.length === 0 && (
                <EmptyState
                    title="No rooms yet"
                    body="Open a room when something breaks, so everyone works from the same timeline."
                    action={<Button onClick={() => setCreating(true)}>Create a room</Button>}
                />
            )}

            {state.status === 'ready' && all.length > 0 && shown.length === 0 && (
                <EmptyState
                    title="No rooms match these filters"
                    body={severity && system ? `No ${severity} rooms in ${system}.` : severity ? `No ${severity} rooms.` : `No rooms in ${system}.`}
                    action={
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setSeverity(null);
                                setSystem('');
                            }}
                        >
                            Clear filters
                        </Button>
                    }
                />
            )}

            {attention.length > 0 && (
                <section className="rooms-group" aria-labelledby="rooms-attention">
                    <h2 id="rooms-attention" className="rooms-group__title">
                        Needs attention
                    </h2>
                    <ul className="rooms-attention">
                        {attention.map((incident) => (
                            <li key={incident.id}>
                                <RoomCard incident={incident} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {rest.length > 0 && (
                <section className="rooms-group" aria-labelledby="rooms-open">
                    <h2 id="rooms-open" className="rooms-group__title">
                        Open <span className="rooms-group__count">{rest.length}</span>
                    </h2>
                    <RoomList incidents={rest} />
                </section>
            )}

            {finished.length > 0 && (
                <details className="rooms-group rooms-group--finished" open={filtering && shownOpen.length === 0}>
                    <summary className="rooms-group__title">
                        Resolved <span className="rooms-group__count">{finished.length}</span>
                    </summary>
                    <RoomList incidents={finished} />
                </details>
            )}

            <CreateRoomModal open={creating} onClose={() => setCreating(false)} onCreated={handleCreated} />
        </div>
    );
}

// an open P1 gets a card: the one kind of room that should catch the eye before anything else
function RoomCard({ incident }: { incident: Incident }): JSX.Element {
    return (
        <Link className="room-card" to={`/rooms/${incident.id}`} data-spotlight>
            <span className="room-card__top">
                <Badge tone="severity" value={incident.severity} />
                <Badge tone="status" value={incident.status} />
            </span>
            <span className="room-card__title">
                <LiveDot state="failing" label="Open P1" decorative />
                {incident.title}
            </span>
            <span className="room-card__meta">
                <span className="room-card__system">{incident.affected_system ?? 'no system'}</span>
                <time dateTime={incident.created_at} title={new Date(incident.created_at).toLocaleString()}>
                    opened {formatRelativeTime(incident.created_at)}
                </time>
                <span>#{incident.id}</span>
            </span>
        </Link>
    );
}

// every other room is a row: severity first, because that is what the eye sorts by
function RoomList({ incidents }: { incidents: Incident[] }): JSX.Element {
    return (
        <ul className="room-list">
            {incidents.map((incident) => (
                <li key={incident.id}>
                    <Link className="room-row" to={`/rooms/${incident.id}`}>
                        <Badge tone="severity" value={incident.severity} />
                        <span className="room-row__title">
                            {incident.title}
                            <span className="room-row__id">#{incident.id}</span>
                        </span>
                        <span className="room-row__system">{incident.affected_system ?? 'no system'}</span>
                        <Badge tone="status" value={incident.status} />
                        <time className="room-row__age" dateTime={incident.created_at} title={new Date(incident.created_at).toLocaleString()}>
                            {formatRelativeTime(incident.created_at)}
                        </time>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

// the shape of the board while it loads, so nothing jumps when the rooms arrive
function RoomsSkeleton(): JSX.Element {
    return (
        <div className="rooms-skeleton" role="status" aria-label="Loading rooms">
            {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="rooms-skeleton__row" />
            ))}
        </div>
    );
}
