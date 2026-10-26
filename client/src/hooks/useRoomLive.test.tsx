/**
 * useRoomLive.test.tsx — the live channel against a fake socket. The cases are the ones a manual
 * two-browser check cannot hold steady: arrivals out of order, the echo of your own post, a
 * reconnect after missed entries, and a handshake rejected because the token aged out.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { connectSocket } from '../api';
import type { TimelineEntry } from '../api';
import { refresh } from '../auth/api';
import { fakeSocket } from '../test/fakeSocket';
import { useRoomLive } from './useRoomLive';
import type { EntriesUpdate } from './useRoomLive';
import type { LogEvent } from './useRoomLog';

vi.mock('../api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../api')>()),
    connectSocket: vi.fn(),
}));
vi.mock('../auth/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../auth/api')>()),
    refresh: vi.fn(),
}));

const ME = 9;

const entry = (id: number, over: Partial<TimelineEntry> = {}): TimelineEntry => ({
    id,
    incident_id: 5,
    author_id: 4,
    type: 'observation',
    body: { text: `entry ${id}` },
    locked: false,
    created_at: new Date().toISOString(),
    ...over,
});

// holds entries the way RoomDetailsPage does and prints what the hook produces
function Harness({ initial, incidentId = 5, onEvent }: { initial: TimelineEntry[]; incidentId?: number | null; onEvent?: (e: LogEvent) => void }) {
    const [entries, setEntries] = useState(initial);
    const apply = useCallback((update: EntriesUpdate) => setEntries((current) => update(current)), []);
    const live = useRoomLive({ incidentId, lastSeenId: entries.at(-1)?.id ?? 0, currentUserId: ME, apply, onEvent });
    return (
        <>
            <p data-testid="ids">{entries.map((e) => `${e.id}:${e.author_id}`).join(',')}</p>
            <p data-testid="state">{live.state}</p>
            <p data-testid="announce">{live.announcement}</p>
        </>
    );
}

const ids = () => screen.getByTestId('ids').textContent;
const liveState = () => screen.getByTestId('state').textContent;
const joins = (socket: ReturnType<typeof fakeSocket>) => socket.emitted.filter(([event]) => event === 'join-room').map(([, p]) => p);

let socket: ReturnType<typeof fakeSocket>;

beforeEach(() => {
    socket = fakeSocket();
    vi.mocked(connectSocket).mockReset().mockReturnValue(socket);
    vi.mocked(refresh).mockReset();
});

describe('useRoomLive', () => {
    it('joins with the highest id already loaded, so the server sends only the gap', () => {
        render(<Harness initial={[entry(1), entry(4)]} />);
        act(() => socket.serverEmit('connect'));

        expect(joins(socket)).toEqual([{ incidentId: 5, sinceId: 4 }]);
        expect(liveState()).toBe('syncing');
    });

    it('acks the history, merges it, and only then calls the room live', () => {
        render(<Harness initial={[entry(1)]} />);
        const ack = vi.fn();
        act(() => {
            socket.serverEmit('connect');
            socket.serverEmit('send-history', [entry(2)], ack);
        });

        expect(ack).toHaveBeenCalledWith('received');
        expect(ids()).toBe('1:4,2:4');
        expect(liveState()).toBe('live');
    });

    // ADR 0001: arrival order is not the order; the id sequence is
    it('inserts broadcast entries by id, even when they arrive out of order', () => {
        render(<Harness initial={[entry(1)]} />);
        act(() => {
            socket.serverEmit('new-message', entry(3));
            socket.serverEmit('new-message', entry(2));
        });

        expect(ids()).toBe('1:4,2:4,3:4');
    });

    it("announces a teammate's entry once, and never the echo of your own", () => {
        render(<Harness initial={[entry(1)]} />);
        act(() => socket.serverEmit('new-message', entry(2, { type: 'finding' })));
        expect(screen.getByTestId('announce').textContent).toBe('New finding in the timeline');

        act(() => socket.serverEmit('new-message', entry(3, { author_id: ME, type: 'action' })));
        expect(screen.getByTestId('announce').textContent).toBe('New finding in the timeline');
    });

    // your POST response lands first, then the same row comes back as the broadcast
    it('does not duplicate an entry the page already holds', () => {
        render(<Harness initial={[entry(1), entry(2)]} />);
        act(() => socket.serverEmit('new-message', entry(2)));

        expect(ids()).toBe('1:4,2:4');
        expect(screen.getByTestId('announce').textContent).toBe('');
    });

    it('rejoins from the newest id after a reconnect and fills the gap', () => {
        render(<Harness initial={[entry(1)]} />);
        act(() => {
            socket.serverEmit('connect');
            socket.serverEmit('send-history', [], vi.fn());
            socket.serverEmit('new-message', entry(2));
            socket.serverEmit('disconnect');
        });
        expect(liveState()).toBe('syncing');

        act(() => {
            socket.serverEmit('connect');
            socket.serverEmit('send-history', [entry(3), entry(4)], vi.fn());
        });

        expect(joins(socket)).toEqual([{ incidentId: 5, sinceId: 1 }, { incidentId: 5, sinceId: 2 }]);
        expect(ids()).toBe('1:4,2:4,3:4,4:4');
        expect(liveState()).toBe('live');
    });

    it('applies a confirmed draft in place and removes a rejected one', () => {
        render(<Harness initial={[entry(1, { type: 'ai_draft', author_id: null }), entry(2, { type: 'ai_draft', author_id: null })]} />);
        act(() => {
            socket.serverEmit('confirm-draft', entry(1, { type: 'ai_draft', author_id: 4 }));
            socket.serverEmit('reject-draft', entry(2, { type: 'ai_draft', author_id: null }));
        });

        expect(ids()).toBe('1:4');
    });

    it('refreshes the token once when the handshake is refused, then reconnects', async () => {
        vi.mocked(refresh).mockResolvedValue('fresh-token');
        render(<Harness initial={[]} />);
        socket.active = false;

        await act(async () => socket.serverEmit('connect_error', new Error('Invalid or expired access token')));

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(socket.connect).toHaveBeenCalledTimes(1);
    });

    it('gives up and shows failing when the session cannot be refreshed', async () => {
        vi.mocked(refresh).mockResolvedValue(null);
        render(<Harness initial={[]} />);
        socket.active = false;

        await act(async () => socket.serverEmit('connect_error', new Error('Invalid or expired access token')));

        expect(socket.connect).not.toHaveBeenCalled();
        expect(liveState()).toBe('failing');
    });

    it('does not refresh in a loop when the second handshake is refused too', async () => {
        vi.mocked(refresh).mockResolvedValue('fresh-token');
        render(<Harness initial={[]} />);
        socket.active = false;

        await act(async () => socket.serverEmit('connect_error', new Error('rejected')));
        await act(async () => socket.serverEmit('connect_error', new Error('rejected')));

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(liveState()).toBe('failing');
    });

    it('leaves a dropped transport to socket.io instead of refreshing', async () => {
        render(<Harness initial={[]} />);

        await act(async () => socket.serverEmit('connect_error', new Error('xhr poll error')));

        expect(refresh).not.toHaveBeenCalled();
        expect(liveState()).toBe('syncing');
    });

    it('opens no socket without a room, and closes it cleanly on unmount', () => {
        render(<Harness initial={[]} incidentId={null} />);
        expect(connectSocket).not.toHaveBeenCalled();

        const { unmount } = render(<Harness initial={[]} />);
        expect(socket.listenerCount()).toBeGreaterThan(0);
        unmount();

        expect(socket.listenerCount()).toBe(0);
        expect(socket.disconnect).toHaveBeenCalled();
    });

    it('reports what actually happens, in order, for the activity log', () => {
        const events: LogEvent[] = [];
        render(<Harness initial={[entry(1)]} onEvent={(e) => events.push(e)} />);
        // separate act() blocks, as real events arrive in separate ticks with a render between them
        act(() => {
            socket.serverEmit('connect');
            socket.serverEmit('send-history', [entry(2)], vi.fn());
        });
        act(() => socket.serverEmit('new-message', entry(3, { type: 'finding' })));
        act(() => socket.serverEmit('new-message', entry(4, { author_id: ME })));
        act(() => socket.serverEmit('disconnect'));
        act(() => socket.serverEmit('connect'));
        act(() => {
            socket.serverEmit('confirm-draft', entry(4, { type: 'ai_draft', author_id: 4 }));
            socket.serverEmit('socket-error', { error: 'Incident room/id does not exist' });
        });

        expect(events.map((e) => `${e.level}: ${e.message}`)).toEqual([
            'info: Connecting to room #5',
            'info: Connected, joining the room',
            'ok: Live. 1 entry caught up from the server',
            'info: New finding #3 from User #4',
            // entry 4 is your own echo: the composer already logged it, so the socket stays quiet
            'warn: Connection lost, retrying',
            'info: Reconnected, rejoining after entry #4',
            'ok: AI draft #4 confirmed by User #4',
            'error: Server error: Incident room/id does not exist',
        ]);
    });
});

