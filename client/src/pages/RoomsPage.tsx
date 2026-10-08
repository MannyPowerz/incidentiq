import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, listIncidents } from '../api';
import type { Incident } from '../api';
import { Badge, Button, EmptyState, ErrorState, Metric, Spinner, Table, useToast } from '../components/ui';
import type { TableColumn } from '../components/ui';
import CreateRoomModal from '../components/rooms/CreateRoomModal';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import './RoomsPage.css';

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; incidents: Incident[] };

// resolved and postmortem rooms are finished; everything else still needs someone
const isOpen = (incident: Incident) => incident.status !== 'resolved' && incident.status !== 'postmortem';

const COLUMNS: TableColumn<Incident>[] = [
    {
        key: 'title',
        header: 'Room',
        // a real link, not a clickable row: rows are not keyboard-reachable (Table.tsx)
        render: (incident) => (
            <Link className="rooms-page__room" to={`/rooms/${incident.id}`}>
                <span className="rooms-page__room-title">{incident.title}</span>
                <span className="rooms-page__room-id">#{incident.id}</span>
            </Link>
        ),
    },
    { key: 'severity', header: 'Severity', width: '7rem', render: (i) => <Badge tone="severity" value={i.severity} /> },
    { key: 'status', header: 'Status', width: '9rem', render: (i) => <Badge tone="status" value={i.status} /> },
    {
        key: 'system',
        header: 'System',
        width: '9rem',
        render: (i) => <span className="rooms-page__mono">{i.affected_system ?? '—'}</span>,
    },
    {
        key: 'opened',
        header: 'Opened',
        width: '9rem',
        render: (i) => (
            <time className="rooms-page__muted" dateTime={i.created_at} title={new Date(i.created_at).toLocaleString()}>
                {formatRelativeTime(i.created_at)}
            </time>
        ),
    },
];

/**
 * RoomsPage — every incident in the caller's org, newest first (the server orders by id DESC).
 * A created room is prepended locally from the POST response rather than refetched: the response is
 * the stored row, so the list never shows data the database doesn't have.
 */
export default function RoomsPage(): JSX.Element {
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [creating, setCreating] = useState(false);
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

    const incidents = state.status === 'ready' ? state.incidents : [];
    const open = incidents.filter(isOpen);

    return (
        <div className="rooms-page">
            <header className="rooms-page__header">
                <div>
                    <p className="rooms-page__eyebrow">War room</p>
                    <h1 className="rooms-page__title">Rooms</h1>
                    <p className="rooms-page__subtitle">One room per incident. Newest first.</p>
                </div>
                <Button onClick={() => setCreating(true)}>New room</Button>
            </header>

            {state.status === 'ready' && incidents.length > 0 && (
                <section className="rooms-page__metrics" aria-label="Summary">
                    <Metric label="Open" value={open.length} tone={open.length > 0 ? 'warning' : 'success'} />
                    <Metric
                        label="P1 open"
                        value={open.filter((i) => i.severity === 'P1').length}
                        tone={open.some((i) => i.severity === 'P1') ? 'danger' : 'neutral'}
                    />
                    <Metric label="Resolved" value={incidents.length - open.length} tone="success" />
                </section>
            )}

            {state.status === 'loading' && (
                <div className="rooms-page__loading">
                    <Spinner label="Loading rooms" />
                </div>
            )}

            {state.status === 'error' && <ErrorState title="Couldn't load rooms" body={state.message} retry={retry} />}

            {state.status === 'ready' && (
                <Table
                    caption="Rooms"
                    columns={COLUMNS}
                    rows={incidents}
                    rowKey={(i) => i.id}
                    empty={
                        <EmptyState
                            title="No rooms yet"
                            body="Open a room when something breaks, so everyone works from the same timeline."
                            action={<Button onClick={() => setCreating(true)}>Create a room</Button>}
                        />
                    }
                />
            )}

            <CreateRoomModal open={creating} onClose={() => setCreating(false)} onCreated={handleCreated} />
        </div>
    );
}
