import { vi } from 'vitest';
import type { RoomSocket } from '../api';

type Handler = (...args: unknown[]) => void;

/**
 * A stand-in for a socket.io client socket: records what the client emits and lets a test play the
 * server's side with serverEmit. Only the surface api/socket.ts and useRoomLive touch is modelled.
 */
export function fakeSocket() {
    const handlers = new Map<string, Set<Handler>>();
    const emitted: Array<[string, unknown]> = [];

    const socket = {
        // true while socket.io would retry by itself; a test sets false to model an auth rejection
        active: true,
        on(event: string, fn: Handler) {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event)!.add(fn);
            return socket;
        },
        off(event: string, fn: Handler) {
            handlers.get(event)?.delete(fn);
            return socket;
        },
        emit(event: string, payload: unknown) {
            emitted.push([event, payload]);
            return socket;
        },
        connect: vi.fn(() => socket),
        disconnect: vi.fn(() => socket),
        // the server's side
        serverEmit(event: string, ...args: unknown[]) {
            const listening = handlers.get(event);
            // a real server's event to an unlistened socket is lost; in a test that is a race in the setup, so say so instead of passing silently
            if (!listening?.size) throw new Error(`serverEmit('${event}'): nothing is listening yet. Wait for the page to subscribe before emitting.`);
            listening.forEach((fn) => fn(...args));
        },
        listening: (event: string) => (handlers.get(event)?.size ?? 0) > 0,
        listenerCount: () => [...handlers.values()].reduce((n, set) => n + set.size, 0),
        emitted,
    };

    return socket as typeof socket & RoomSocket;
}
