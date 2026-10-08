/**
 * socket.test.ts — the three socket rules a room page could get wrong without noticing:
 * history must be acked (the server sends a socket-error after 5s otherwise), sinceId must be a
 * positive id or absent (the server's schema rejects 0), and merged entries stay ordered by id.
 *
 * socket.io-client is mocked: these test the wrapper's contract, not the network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TimelineEntry } from './types';

type Handler = (...args: unknown[]) => void;

const fakeSocket = {
    handlers: new Map<string, Handler[]>(),
    emitted: [] as Array<{ event: string; payload: unknown }>,
    on(event: string, h: Handler) {
        this.handlers.set(event, [...(this.handlers.get(event) ?? []), h]);
        return this;
    },
    off(event: string, h: Handler) {
        this.handlers.set(event, (this.handlers.get(event) ?? []).filter((x) => x !== h));
        return this;
    },
    emit(event: string, payload: unknown) {
        this.emitted.push({ event, payload });
        return this;
    },
    disconnect: vi.fn(),
    // test helper: deliver a server event to whatever is subscribed
    receive(event: string, ...args: unknown[]) {
        (this.handlers.get(event) ?? []).forEach((h) => h(...args));
    },
};

const ioMock = vi.fn((_opts?: unknown) => fakeSocket);
vi.mock('socket.io-client', () => ({ io: (opts: unknown) => ioMock(opts) }));

const { connectSocket, disconnectSocket, joinRoom, mergeEntries, onConfirm, onEntry, onHistory, onReject, onSocketError } =
    await import('./socket');
const { setAccessToken } = await import('../auth/tokenStore');

const entry = (id: number, over: Partial<TimelineEntry> = {}): TimelineEntry => ({
    id,
    incident_id: 7,
    author_id: 1,
    type: 'observation',
    body: {},
    locked: false,
    created_at: '2026-10-08T00:00:00.000Z',
    ...over,
});

beforeEach(() => {
    fakeSocket.handlers.clear();
    fakeSocket.emitted.length = 0;
    fakeSocket.disconnect.mockClear();
    ioMock.mockClear();
});

describe('connectSocket', () => {
    // a reconnect after a silent HTTP refresh must send the NEW token, not the one from first connect
    it('reads the token fresh on every (re)connect via an auth callback', () => {
        const socket = connectSocket();
        const opts = ioMock.mock.calls[0]?.[0] as { auth: (cb: (v: unknown) => void) => void };
        expect(typeof opts.auth).toBe('function');

        setAccessToken('first-token');
        const seen: unknown[] = [];
        opts.auth((v) => seen.push(v));
        setAccessToken('refreshed-token');
        opts.auth((v) => seen.push(v));

        expect(seen).toEqual([{ token: 'first-token' }, { token: 'refreshed-token' }]);
        disconnectSocket(socket);
        expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
    });
});

describe('joinRoom', () => {
    it('sends just the incident on a first join', () => {
        joinRoom(connectSocket(), 7);
        expect(fakeSocket.emitted).toEqual([{ event: 'join-room', payload: { incidentId: 7 } }]);
    });

    it('sends sinceId on a rejoin so the server only replays the gap', () => {
        joinRoom(connectSocket(), 7, 42);
        expect(fakeSocket.emitted[0]?.payload).toEqual({ incidentId: 7, sinceId: 42 });
    });

    // joinRoomSchema requires a positive int; sending 0 would fail validation and drop the join
    it('drops a sinceId of 0 rather than sending a value the server rejects', () => {
        joinRoom(connectSocket(), 7, 0);
        expect(fakeSocket.emitted[0]?.payload).toEqual({ incidentId: 7 });
    });
});

describe('onHistory', () => {
    it('acks the server, then hands on the entries', () => {
        const socket = connectSocket();
        const received: TimelineEntry[][] = [];
        onHistory(socket, (entries) => received.push(entries));

        const ack = vi.fn();
        fakeSocket.receive('send-history', [entry(1), entry(2)], ack);

        expect(ack).toHaveBeenCalledTimes(1);
        expect(received).toEqual([[entry(1), entry(2)]]);
    });

    it('stops listening after unsubscribe', () => {
        const socket = connectSocket();
        const cb = vi.fn();
        const off = onHistory(socket, cb);
        off();
        fakeSocket.receive('send-history', [entry(1)], vi.fn());
        expect(cb).not.toHaveBeenCalled();
    });
});

describe('live events', () => {
    it('routes new-message, confirm-draft and reject-draft to their own callbacks', () => {
        const socket = connectSocket();
        const got: string[] = [];
        onEntry(socket, (e) => got.push(`new:${e.id}`));
        onConfirm(socket, (e) => got.push(`confirm:${e.id}`));
        onReject(socket, (e) => got.push(`reject:${e.id}`));

        fakeSocket.receive('new-message', entry(3));
        fakeSocket.receive('confirm-draft', entry(4));
        fakeSocket.receive('reject-draft', entry(5));

        expect(got).toEqual(['new:3', 'confirm:4', 'reject:5']);
    });

    it('unsubscribes only its own handler', () => {
        const socket = connectSocket();
        const a = vi.fn();
        const b = vi.fn();
        const offA = onEntry(socket, a);
        onEntry(socket, b);
        offA();
        fakeSocket.receive('new-message', entry(1));
        expect(a).not.toHaveBeenCalled();
        expect(b).toHaveBeenCalledTimes(1);
    });

    it('passes socket-error text through', () => {
        const socket = connectSocket();
        const cb = vi.fn();
        onSocketError(socket, cb);
        fakeSocket.receive('socket-error', { error: 'Incident room/id does not exist' });
        expect(cb).toHaveBeenCalledWith('Incident room/id does not exist');
    });
});

describe('mergeEntries', () => {
    // ADR 0001: id order is truth; a late-arriving lower id slots in, not at the end
    it('keeps id-ascending order when an older entry arrives late', () => {
        const merged = mergeEntries([entry(1), entry(3)], [entry(2)]);
        expect(merged.map((e) => e.id)).toEqual([1, 2, 3]);
    });

    // the entry you posted over HTTP also comes back over the socket
    it('dedupes by id, keeping the incoming version', () => {
        const merged = mergeEntries([entry(1, { author_id: null })], [entry(1, { author_id: 9 })]);
        expect(merged).toHaveLength(1);
        expect(merged[0]?.author_id).toBe(9);
    });

    it('does not mutate the array it was given', () => {
        const current = [entry(2)];
        mergeEntries(current, [entry(1)]);
        expect(current.map((e) => e.id)).toEqual([2]);
    });
});
