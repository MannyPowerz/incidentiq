/**
 * socket.ts — the war room's live channel. Event names and payloads mirror
 * server/src/Socket/socketTypes-Schemas/socketTypes.ts; join behavior mirrors
 * server/src/Socket/socketHandlers/createRoom.ts.
 *
 * Connects through the Vite dev proxy (/socket.io, ws: true in vite.config.ts), so no host is
 * passed — io() uses the page's own origin, the same reason the refresh cookie works.
 */

import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getAccessToken } from '../auth/tokenStore';
import type { TimelineEntry } from './types';

interface ServerToClient {
    // sent right after join-room: full history, or only id > sinceId on a rejoin. Has an ack — see onHistory.
    'send-history': (entries: TimelineEntry[], ack: (response: string) => void) => void;
    success: (value: { success: string }) => void;
    'User-joined': (value: { message: string }) => void;
    'new-message': (entry: TimelineEntry) => void;
    'confirm-draft': (entry: TimelineEntry) => void;
    'reject-draft': (entry: TimelineEntry) => void;
    'socket-error': (value: { error: string }) => void;
}

interface ClientToServer {
    'join-room': (payload: { incidentId: number; sinceId?: number }) => void;
}

export type RoomSocket = Socket<ServerToClient, ClientToServer>;

type Unsubscribe = () => void;

/**
 * Auth is a callback, not a fixed object: socket.io calls it on every connect AND every automatic
 * reconnect, so a reconnect after a silent HTTP refresh picks up the new token instead of retrying
 * the expired one forever. The server checks the token only at handshake (Socket/middleware/socket.ts).
 */
export function connectSocket(): RoomSocket {
    return io({
        auth: (cb) => cb({ token: getAccessToken() }),
    });
}

export function disconnectSocket(socket: RoomSocket): void {
    socket.disconnect();
}

/**
 * The server's joinRoomSchema requires sinceId to be a positive integer or absent. 0 or a negative
 * number would be rejected and the whole join would fail, so anything that isn't a real entry id
 * is dropped and the server sends full history instead.
 * There is no leave-room event server-side; leaving a room means disconnecting.
 */
export function joinRoom(socket: RoomSocket, incidentId: number, sinceId?: number): void {
    const payload = sinceId !== undefined && sinceId > 0 ? { incidentId, sinceId } : { incidentId };
    socket.emit('join-room', payload);
}

/**
 * The server emits send-history with a 5-second ack timeout. Without the ack it logs a failure and
 * sends this client a socket-error, even though the history arrived. So the ack is sent here,
 * unconditionally, before handing the entries on — no caller can forget it.
 */
export function onHistory(socket: RoomSocket, cb: (entries: TimelineEntry[]) => void): Unsubscribe {
    const handler: ServerToClient['send-history'] = (entries, ack) => {
        ack('received');
        cb(entries);
    };
    socket.on('send-history', handler);
    return () => socket.off('send-history', handler);
}

// each returns its own unsubscribe so a room page can clean up exactly what it added
function subscribe<E extends 'new-message' | 'confirm-draft' | 'reject-draft'>(
    socket: RoomSocket,
    event: E,
    cb: (entry: TimelineEntry) => void,
): Unsubscribe {
    const handler = ((entry: TimelineEntry) => cb(entry)) as ServerToClient[E];
    socket.on(event, handler as never);
    return () => socket.off(event, handler as never);
}

export const onEntry = (socket: RoomSocket, cb: (entry: TimelineEntry) => void) => subscribe(socket, 'new-message', cb);
export const onConfirm = (socket: RoomSocket, cb: (entry: TimelineEntry) => void) => subscribe(socket, 'confirm-draft', cb);
export const onReject = (socket: RoomSocket, cb: (entry: TimelineEntry) => void) => subscribe(socket, 'reject-draft', cb);

export function onSocketError(socket: RoomSocket, cb: (error: string) => void): Unsubscribe {
    const handler: ServerToClient['socket-error'] = ({ error }) => cb(error);
    socket.on('socket-error', handler);
    return () => socket.off('socket-error', handler);
}

/**
 * Merges arriving entries into what is already held: dedupes by id (an entry you posted over HTTP
 * also arrives over the socket) and keeps id-ascending order. ADR 0001 — the id sequence is the
 * ordering truth, never arrival order, so entries are inserted by id, never appended.
 */
export function mergeEntries(current: TimelineEntry[], incoming: TimelineEntry[]): TimelineEntry[] {
    const byId = new Map(current.map((entry) => [entry.id, entry]));
    for (const entry of incoming) byId.set(entry.id, entry);
    return [...byId.values()].sort((a, b) => a.id - b.id);
}
